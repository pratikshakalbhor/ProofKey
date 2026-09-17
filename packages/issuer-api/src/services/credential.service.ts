import { and, count, desc, eq, gte, lte } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import {
  serializeCredential,
  type CredentialDisclosure,
  type CredentialIssuanceRequest,
  type SerializedCredential,
  type SerializedCredentialPayload,
  type SerializedJubjubSignature,
} from '@verishield/shared';
import { db } from '../db/client.js';
import {
  credentials,
  institutions,
  schemas,
  students,
  type CredentialRow,
  type Institution,
  type SchemaRow,
  type Student,
} from '../db/schema.js';
import { paginate, type Paginated } from '../dto/common.js';
import type { BulkIssueInput, IssueCredentialInput, ListCredentialsQuery } from '../dto/credentials.js';
import { AppError } from '../lib/errors.js';
import { bytesToHex } from '../lib/json.js';
import { loadSdk } from '../lib/sdk.js';
import { recordAudit } from './audit.service.js';
import { buildClaimUrl, createClaimToken, renderQrDataUrl, verifyClaimToken } from './delivery.service.js';
import { anchorCredential, publishRevocationRoot, revokeOnChain } from './midnight.service.js';
import { getRevocationStatus, revocationTree, type RevocationStatus } from './revocation.service.js';
import { generateSalt, getInstitutionSecret } from './signing.service.js';

/**
 * CredentialService — issuance, listing, revocation and delivery.
 *
 * The private payload only ever lives in memory during issuance (and in the
 * issuer's own database, which is its system of record). The on-chain contract
 * stores commitments only; `payloadHash` is the commitment.
 */

export interface CredentialStudentRef {
  id: string;
  name: string;
  rollNumber: string;
  program: string;
}

export interface CredentialSchemaRef {
  id: string;
  name: string;
  version: string;
}

export interface CredentialSummary {
  id: string;
  institutionId: string;
  studentId: string;
  schemaId: string;
  /** Hex commitment anchored on-chain. */
  payloadHash: string;
  leaf: string | null;
  status: string;
  issuedAt: string;
  expiresAt: string;
  revokedAt: string | null;
  revocationReason: string | null;
  onchainTxId: string | null;
  student?: CredentialStudentRef;
  schema?: CredentialSchemaRef;
}

function schemaKey(row: SchemaRow): string {
  return `${row.name}@${row.version}`;
}

function parseDateOrUndefined(value: string | undefined, field: string): Date | undefined {
  if (value === undefined) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw AppError.badRequest(`${field} is not a valid date`);
  return date;
}

function toSummary(row: CredentialRow, student?: Student, schemaRow?: SchemaRow): CredentialSummary {
  return {
    id: row.id,
    institutionId: row.institutionId,
    studentId: row.studentId,
    schemaId: row.schemaId,
    payloadHash: row.payloadHash,
    leaf: row.leaf,
    status: row.status,
    issuedAt: row.issuedAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
    revocationReason: row.revocationReason,
    onchainTxId: row.onchainTxId,
    student: student
      ? {
          id: student.id,
          name: student.name,
          rollNumber: student.rollNumber,
          program: student.program,
        }
      : undefined,
    schema: schemaRow
      ? { id: schemaRow.id, name: schemaRow.name, version: schemaRow.version }
      : undefined,
  };
}

function enrich(row: CredentialRow): CredentialSummary {
  const student = db.select().from(students).where(eq(students.id, row.studentId)).get();
  const schemaRow = db.select().from(schemas).where(eq(schemas.id, row.schemaId)).get();
  return toSummary(row, student, schemaRow);
}

function buildIssuanceRequest(
  institution: Institution,
  student: Student,
  schemaRow: SchemaRow,
  options: { degree?: string; issuedAt?: Date; expiresAt?: Date; salt: Uint8Array },
): CredentialIssuanceRequest {
  return {
    issuerName: institution.name,
    schemaName: schemaKey(schemaRow),
    subject: {
      name: student.name,
      degree: options.degree ?? student.program,
      dateOfBirth: student.dob,
      cgpa: student.cgpa,
      holderBinding: `roll:${institution.id}:${student.rollNumber}`,
    },
    issuedAt: options.issuedAt,
    expiresAt: options.expiresAt,
    salt: options.salt,
  };
}

export interface IssueCredentialResult {
  credential: CredentialSummary;
  /** Wire-safe credential handed to the holder exactly once. */
  serialized: SerializedCredential;
}

export async function issueCredential(
  institution: Institution,
  input: IssueCredentialInput,
  actorId: string | null,
): Promise<IssueCredentialResult> {
  const student = db
    .select()
    .from(students)
    .where(and(eq(students.id, input.studentId), eq(students.institutionId, institution.id)))
    .get();
  if (!student) throw AppError.notFound('Student not found');
  if (student.status === 'suspended' || student.status === 'withdrawn') {
    throw AppError.badRequest(`Cannot issue credentials to a ${student.status} student`);
  }

  const schemaRow = db.select().from(schemas).where(eq(schemas.id, input.schemaId)).get();
  if (!schemaRow) throw AppError.notFound('Credential schema not found');

  const salt = await generateSalt();
  const request = buildIssuanceRequest(institution, student, schemaRow, {
    degree: input.degree,
    issuedAt: parseDateOrUndefined(input.issuedAt, 'issuedAt'),
    expiresAt: parseDateOrUndefined(input.expiresAt, 'expiresAt'),
    salt,
  });

  const secret = await getInstitutionSecret(institution);
  const built = await anchorCredential(request, secret);
  const serialized = serializeCredential(built);

  const row: CredentialRow = {
    id: `cred_${nanoid(16)}`,
    institutionId: institution.id,
    studentId: student.id,
    schemaId: schemaRow.id,
    payloadHash: bytesToHex(built.commitment),
    salt: serialized.salt,
    payloadJson: JSON.stringify(serialized.payload),
    signature: JSON.stringify(serialized.signature),
    leaf: bytesToHex(built.leaf),
    onchainTxId: null,
    issuedAt: new Date(Number(built.payload.issueDate) * 1000),
    expiresAt: new Date(Number(built.payload.expiryDate) * 1000),
    status: 'issued',
    revokedAt: null,
    revocationReason: null,
  };
  db.insert(credentials).values(row).run();

  recordAudit(actorId, 'credential.issue', row.id, {
    studentId: student.id,
    schemaId: schemaRow.id,
    commitment: row.payloadHash,
  });

  return { credential: toSummary(row, student, schemaRow), serialized };
}

export interface BulkIssueResult {
  issued: CredentialSummary[];
  failed: { studentId: string; reason: string }[];
}

export async function bulkIssue(
  institution: Institution,
  input: BulkIssueInput,
  actorId: string | null,
): Promise<BulkIssueResult> {
  const issued: CredentialSummary[] = [];
  const failed: { studentId: string; reason: string }[] = [];

  for (const studentId of input.studentIds) {
    try {
      const result = await issueCredential(
        institution,
        {
          studentId,
          schemaId: input.schemaId,
          issuedAt: input.issuedAt,
          expiresAt: input.expiresAt,
          degree: input.degree,
          deliveryTtlDays: input.deliveryTtlDays,
        },
        actorId,
      );
      issued.push(result.credential);
    } catch (error) {
      failed.push({
        studentId,
        reason: error instanceof AppError ? error.message : (error as Error).message,
      });
    }
  }

  return { issued, failed };
}

export function listCredentials(
  institutionId: string,
  query: ListCredentialsQuery,
): Paginated<CredentialSummary> {
  const filters = [eq(credentials.institutionId, institutionId)];
  if (query.status) filters.push(eq(credentials.status, query.status));
  if (query.studentId) filters.push(eq(credentials.studentId, query.studentId));
  if (query.schemaId) filters.push(eq(credentials.schemaId, query.schemaId));
  const from = parseDateOrUndefined(query.from, 'from');
  const to = parseDateOrUndefined(query.to, 'to');
  if (from) filters.push(gte(credentials.issuedAt, from));
  if (to) filters.push(lte(credentials.issuedAt, to));

  const where = and(...filters);
  const rows = db
    .select()
    .from(credentials)
    .where(where)
    .orderBy(desc(credentials.issuedAt))
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize)
    .all();
  const total = db.select({ value: count() }).from(credentials).where(where).get()?.value ?? 0;

  return paginate(rows.map(enrich), query.page, query.pageSize, total);
}

export function getCredential(institutionId: string, id: string): CredentialSummary {
  const row = db
    .select()
    .from(credentials)
    .where(and(eq(credentials.id, id), eq(credentials.institutionId, institutionId)))
    .get();
  if (!row) throw AppError.notFound('Credential not found');
  return enrich(row);
}

function getCredentialRow(institutionId: string, id: string): CredentialRow {
  const row = db
    .select()
    .from(credentials)
    .where(and(eq(credentials.id, id), eq(credentials.institutionId, institutionId)))
    .get();
  if (!row) throw AppError.notFound('Credential not found');
  return row;
}

export interface RevokeCredentialResult extends CredentialSummary {
  revocationRoot: string;
}

/** Revokes a credential on-chain and republishes the institution's revocation root. */
export async function revokeCredential(
  institution: Institution,
  id: string,
  reason: string,
  actorId: string | null,
): Promise<RevokeCredentialResult> {
  const row = getCredentialRow(institution.id, id);
  if (row.status === 'revoked') throw AppError.conflict('Credential is already revoked');

  const secret = await getInstitutionSecret(institution);
  await revokeOnChain(institution.name, row.payloadHash, secret);

  const revokedAt = new Date();
  db.update(credentials)
    .set({ status: 'revoked', revokedAt, revocationReason: reason })
    .where(eq(credentials.id, row.id))
    .run();

  const tree = revocationTree(institution.id);
  await publishRevocationRoot(institution.name, tree.root, secret);

  recordAudit(actorId, 'credential.revoke', row.id, { reason, revocationRoot: tree.root });

  const updated: CredentialRow = {
    ...row,
    status: 'revoked',
    revokedAt,
    revocationReason: reason,
  };
  const student = db.select().from(students).where(eq(students.id, row.studentId)).get();
  const schemaRow = db.select().from(schemas).where(eq(schemas.id, row.schemaId)).get();
  return { ...toSummary(updated, student, schemaRow), revocationRoot: tree.root };
}

export function getCredentialRevocationStatus(
  institutionId: string,
  id: string,
): RevocationStatus {
  const row = getCredentialRow(institutionId, id);
  return getRevocationStatus(institutionId, row.payloadHash);
}

export interface DeliveryResult {
  credentialId: string;
  token: string;
  claimUrl: string;
  expiresAt: string;
  qrDataUrl: string;
}

/** Builds a one-time claim link + QR for handing the credential to its holder. */
export async function getDelivery(
  institution: Institution,
  id: string,
  options: { baseUrl?: string; ttlDays?: number },
): Promise<DeliveryResult> {
  const row = getCredentialRow(institution.id, id);
  if (row.status === 'revoked') throw AppError.badRequest('Cannot deliver a revoked credential');

  const ttlDays = options.ttlDays ?? 30;
  const { token, expiresAt } = createClaimToken(row.id, institution.id, ttlDays);
  const claimUrl = buildClaimUrl(options.baseUrl ?? 'http://localhost:3000', token);
  const qrDataUrl = await renderQrDataUrl(claimUrl);

  return {
    credentialId: row.id,
    token,
    claimUrl,
    expiresAt: expiresAt.toISOString(),
    qrDataUrl,
  };
}

export interface ClaimedCredential {
  credentialId: string;
  institutionId: string;
  serialized: SerializedCredential;
}

/**
 * Exchanges a claim token for the credential material. Marks the credential
 * `delivered` on first claim. After this the holder owns the payload; the API
 * is never sent it again.
 */
export async function claimCredential(token: string): Promise<ClaimedCredential> {
  const claims = verifyClaimToken(token);
  const row = db.select().from(credentials).where(eq(credentials.id, claims.credentialId)).get();
  if (!row) throw AppError.notFound('Credential not found');
  if (row.status === 'revoked') throw AppError.badRequest('Credential has been revoked');
  if (!row.payloadJson || !row.salt || !row.leaf) {
    throw AppError.internal('Credential material is incomplete and cannot be delivered');
  }

  const institution = db
    .select()
    .from(institutions)
    .where(eq(institutions.id, row.institutionId))
    .get();
  if (!institution) throw AppError.internal('Issuing institution is missing');
  const schemaRow = db.select().from(schemas).where(eq(schemas.id, row.schemaId)).get();
  if (!schemaRow) throw AppError.internal('Credential schema is missing');

  const sdk = await loadSdk();
  const disclosure: CredentialDisclosure = {
    id: row.id,
    issuerId: bytesToHex(sdk.hashLabel(`issuer:${institution.name}`)),
    issuerName: institution.name,
    schemaId: bytesToHex(sdk.hashLabel(`schema:${schemaKey(schemaRow)}`)),
    schemaName: schemaKey(schemaRow),
    commitment: row.payloadHash,
    leaf: row.leaf,
    issuerVerifyingKey: JSON.parse(institution.publicKey) as { x: string; y: string },
    issuedAt: Math.floor(row.issuedAt.getTime() / 1000),
    expiresAt: Math.floor(row.expiresAt.getTime() / 1000),
  };

  const serialized: SerializedCredential = {
    version: 1,
    payload: JSON.parse(row.payloadJson) as SerializedCredentialPayload,
    salt: row.salt,
    commitment: row.payloadHash,
    leaf: row.leaf,
    signature: JSON.parse(row.signature) as SerializedJubjubSignature,
    disclosure,
  };

  if (row.status === 'issued') {
    db.update(credentials).set({ status: 'delivered' }).where(eq(credentials.id, row.id)).run();
    recordAudit(null, 'credential.claim', row.id, { deliveredAt: new Date().toISOString() });
  }

  return { credentialId: row.id, institutionId: row.institutionId, serialized };
}
