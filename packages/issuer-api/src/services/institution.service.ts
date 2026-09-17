import { asc, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/client.js';
import { institutions, type Institution } from '../db/schema.js';
import { AppError } from '../lib/errors.js';
import { recordAudit } from './audit.service.js';
import { registerIssuer as registerIssuerOnChain } from './midnight.service.js';
import { describeKeyStatus, generateInstitutionKeypair, getInstitutionSecret } from './signing.service.js';

export function getInstitution(id: string): Institution {
  const row = db.select().from(institutions).where(eq(institutions.id, id)).get();
  if (!row) throw AppError.notFound('Institution not found');
  return row;
}

export function getPrimaryInstitution(): Institution | undefined {
  return db.select().from(institutions).orderBy(asc(institutions.createdAt)).get();
}

export interface CreateInstitutionInput {
  name: string;
  type: string;
  logoUrl?: string;
}

export async function createInstitution(input: CreateInstitutionInput): Promise<Institution> {
  const { encryptedSecret, publicKey } = await generateInstitutionKeypair();
  const row: Institution = {
    id: `inst_${nanoid(16)}`,
    name: input.name,
    type: input.type,
    publicKey: JSON.stringify(publicKey),
    encryptedPrivateKey: encryptedSecret,
    midnightTxId: null,
    logoUrl: input.logoUrl ?? null,
    createdAt: new Date(),
  };
  db.insert(institutions).values(row).run();
  recordAudit(null, 'institution.create', row.id, { name: input.name, type: input.type });
  return row;
}

export interface AnchorIssuerResult {
  alreadyAnchored: boolean;
  issuerId?: string;
  verifyingKey?: { x: string; y: string };
  keyStatus: ReturnType<typeof describeKeyStatus>;
}

/** Anchors the institution's verifying key via `registerIssuer` on Midnight. */
export async function anchorIssuerOnChain(
  institution: Institution,
  actorId: string | null,
  force = false,
): Promise<AnchorIssuerResult> {
  const keyStatus = describeKeyStatus(institution);
  if (institution.midnightTxId && !force) {
    return { alreadyAnchored: true, keyStatus };
  }

  const secret = await getInstitutionSecret(institution);
  const anchor = await registerIssuerOnChain(institution.name, secret);

  // The simulator exposes no transaction id; it is populated once the contract
  // is deployed to the devnet and `CONTRACT_ADDRESS` is configured.
  recordAudit(actorId, 'institution.register-on-chain', institution.id, {
    issuerId: anchor.issuerId,
  });

  return {
    alreadyAnchored: false,
    issuerId: anchor.issuerId,
    verifyingKey: anchor.verifyingKey,
    keyStatus: describeKeyStatus(institution),
  };
}

export function getKeyStatus(institution: Institution): ReturnType<typeof describeKeyStatus> {
  return describeKeyStatus(institution);
}
