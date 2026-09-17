import { and, asc, count, desc, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/client.js';
import { schemas, type SchemaRow } from '../db/schema.js';
import { paginate, type Paginated } from '../dto/common.js';
import type {
  CreateCredentialSchemaInput,
  ListSchemasQuery,
} from '../dto/credential-schemas.js';
import { AppError } from '../lib/errors.js';
import { recordAudit } from './audit.service.js';

/**
 * Credential schemas are global (shared across institutions), matching the
 * `schemas` table definition.
 */

export function listSchemas(query: ListSchemasQuery): Paginated<SchemaRow> {
  const filters = query.name ? [eq(schemas.name, query.name)] : [];
  const where = filters.length ? and(...filters) : undefined;

  const rows = db
    .select()
    .from(schemas)
    .where(where)
    .orderBy(desc(schemas.createdAt))
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize)
    .all();
  const total = db.select({ value: count() }).from(schemas).where(where).get()?.value ?? 0;

  return paginate(rows, query.page, query.pageSize, total);
}

export function getSchema(id: string): SchemaRow {
  const row = db.select().from(schemas).where(eq(schemas.id, id)).get();
  if (!row) throw AppError.notFound('Credential schema not found');
  return row;
}

export function findSchemaByNameVersion(name: string, version: string): SchemaRow | undefined {
  return db
    .select()
    .from(schemas)
    .where(and(eq(schemas.name, name), eq(schemas.version, version)))
    .get();
}

export function createSchema(
  input: CreateCredentialSchemaInput,
  actorId: string | null,
): SchemaRow {
  if (findSchemaByNameVersion(input.name, input.version)) {
    throw AppError.conflict(`Schema ${input.name}@${input.version} already exists`);
  }
  const row: SchemaRow = {
    id: `sch_${nanoid(16)}`,
    name: input.name,
    version: input.version,
    fieldsJson: JSON.stringify(input.fields),
    createdAt: new Date(),
  };
  db.insert(schemas).values(row).run();
  recordAudit(actorId, 'schema.create', row.id, { name: row.name, version: row.version });
  return row;
}

export function parseSchemaFields(row: SchemaRow): Array<{ name: string; type: string; required: boolean }> {
  return JSON.parse(row.fieldsJson) as Array<{ name: string; type: string; required: boolean }>;
}

export function sortSchemasForDisplay(rows: SchemaRow[]): SchemaRow[] {
  return [...rows].sort((a, b) => a.name.localeCompare(b.name));
}

export { asc };
