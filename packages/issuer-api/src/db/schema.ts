import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

/**
 * Issuer-side relational schema (SQLite via Drizzle).
 *
 * This database is the university's *internal* system of record. It stores the
 * plaintext student record and the issued credential metadata. The on-chain
 * contract only ever sees commitments / hashes; nothing in here is published.
 */

export const institutions = sqliteTable('institutions', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  /** JubJub verifying key, hex-encoded `{x,y}` JSON. */
  publicKey: text('public_key').notNull(),
  /** AES-256-GCM envelope of the institution's signing secret. Never plaintext. */
  encryptedPrivateKey: text('encrypted_private_key').notNull(),
  /** Midnight tx id of the on-chain `registerIssuer` anchor, once confirmed. */
  midnightTxId: text('midnight_tx_id'),
  logoUrl: text('logo_url'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export const admins = sqliteTable('admins', {
  id: text('id').primaryKey(),
  institutionId: text('institution_id')
    .notNull()
    .references(() => institutions.id, { onDelete: 'cascade' }),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  /** admin | registrar | viewer */
  role: text('role').notNull().default('viewer'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export const students = sqliteTable('students', {
  id: text('id').primaryKey(),
  institutionId: text('institution_id')
    .notNull()
    .references(() => institutions.id, { onDelete: 'cascade' }),
  rollNumber: text('roll_number').notNull(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  dob: text('dob').notNull(),
  program: text('program').notNull(),
  graduationYear: integer('graduation_year').notNull(),
  cgpa: real('cgpa').notNull(),
  /** active | graduated | suspended | withdrawn */
  status: text('status').notNull().default('active'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export const schemas = sqliteTable('schemas', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  version: text('version').notNull(),
  fieldsJson: text('fields_json').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export const credentials = sqliteTable('credentials', {
  id: text('id').primaryKey(),
  institutionId: text('institution_id')
    .notNull()
    .references(() => institutions.id, { onDelete: 'cascade' }),
  studentId: text('student_id')
    .notNull()
    .references(() => students.id, { onDelete: 'cascade' }),
  schemaId: text('schema_id')
    .notNull()
    .references(() => schemas.id),
  /** Hex commitment = the on-chain payload hash (`persistentCommit`). */
  payloadHash: text('payload_hash').notNull(),
  /** Hex commitment salt. Required to re-derive the credential for delivery. */
  salt: text('salt'),
  /** JSON `SerializedCredentialPayload` — internal, never published. */
  payloadJson: text('payload_json'),
  /** JSON-encoded JubJub Schnorr signature { announcement:{x,y}, response }. */
  signature: text('signature').notNull(),
  /** Issuance leaf `(issuerId, commitment)` used by the on-chain accumulator. */
  leaf: text('leaf'),
  /** Midnight tx id once anchored. */
  onchainTxId: text('onchain_tx_id'),
  issuedAt: integer('issued_at', { mode: 'timestamp_ms' }).notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  /** issued | delivered | revoked */
  status: text('status').notNull().default('issued'),
  revokedAt: integer('revoked_at', { mode: 'timestamp_ms' }),
  revocationReason: text('revocation_reason'),
});

export const auditLog = sqliteTable('audit_log', {
  id: text('id').primaryKey(),
  actorId: text('actor_id').references(() => admins.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  targetId: text('target_id'),
  metadataJson: text('metadata_json'),
  timestamp: integer('timestamp', { mode: 'timestamp_ms' }).notNull(),
});

export const proofRequests = sqliteTable('proof_requests', {
  id: text('id').primaryKey(),
  verifierName: text('verifier_name').notNull(),
  claimType: text('claim_type').notNull(),
  /** pending | responded | expired */
  status: text('status').notNull().default('pending'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  respondedAt: integer('responded_at', { mode: 'timestamp_ms' }),
});

export type Institution = typeof institutions.$inferSelect;
export type Admin = typeof admins.$inferSelect;
export type Student = typeof students.$inferSelect;
export type SchemaRow = typeof schemas.$inferSelect;
export type CredentialRow = typeof credentials.$inferSelect;
export type AuditRow = typeof auditLog.$inferSelect;
export type ProofRequestRow = typeof proofRequests.$inferSelect;
