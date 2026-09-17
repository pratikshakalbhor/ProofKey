import { pathToFileURL } from 'node:url';
import { sqlite } from './client.js';

/**
 * Idempotent schema migration.
 *
 * Kept as raw DDL so the API boots with no codegen step. `drizzle-kit generate`
 * (see drizzle.config.ts) can be layered on later for tracked migrations.
 */
const DDL = `
CREATE TABLE IF NOT EXISTS institutions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  public_key TEXT NOT NULL,
  encrypted_private_key TEXT NOT NULL,
  midnight_tx_id TEXT,
  logo_url TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS admins (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_admins_institution ON admins(institution_id);

CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  roll_number TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  dob TEXT NOT NULL,
  program TEXT NOT NULL,
  graduation_year INTEGER NOT NULL,
  cgpa REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_students_institution_roll ON students(institution_id, roll_number);
CREATE INDEX IF NOT EXISTS idx_students_institution ON students(institution_id);
CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);
CREATE INDEX IF NOT EXISTS idx_students_program ON students(program);

CREATE TABLE IF NOT EXISTS schemas (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  fields_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_schemas_name_version ON schemas(name, version);

CREATE TABLE IF NOT EXISTS credentials (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  schema_id TEXT NOT NULL REFERENCES schemas(id),
  payload_hash TEXT NOT NULL,
  salt TEXT,
  payload_json TEXT,
  signature TEXT NOT NULL,
  leaf TEXT,
  onchain_tx_id TEXT,
  issued_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'issued',
  revoked_at INTEGER,
  revocation_reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_credentials_institution ON credentials(institution_id);
CREATE INDEX IF NOT EXISTS idx_credentials_student ON credentials(student_id);
CREATE INDEX IF NOT EXISTS idx_credentials_status ON credentials(status);
CREATE INDEX IF NOT EXISTS idx_credentials_issued_at ON credentials(issued_at);
CREATE INDEX IF NOT EXISTS idx_credentials_payload_hash ON credentials(payload_hash);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  actor_id TEXT REFERENCES admins(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_id TEXT,
  metadata_json TEXT,
  timestamp INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(actor_id);

CREATE TABLE IF NOT EXISTS proof_requests (
  id TEXT PRIMARY KEY,
  verifier_name TEXT NOT NULL,
  claim_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  responded_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_proof_requests_status ON proof_requests(status);
`;

export function migrate(): void {
  sqlite.exec(DDL);
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  migrate();
  console.log('[migrate] schema is up to date');
}
