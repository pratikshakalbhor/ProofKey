import { and, count, desc, eq, gte, lte } from 'drizzle-orm';
import { db } from '../db/client.js';
import { auditLog, type AuditRow } from '../db/schema.js';
import { paginate, type Paginated } from '../dto/common.js';
import type { ListAuditQuery } from '../dto/audit.js';

export interface AuditEntry {
  id: string;
  actorId: string | null;
  action: string;
  targetId: string | null;
  metadata: unknown;
  timestamp: string;
}

export function listAuditLog(query: ListAuditQuery): Paginated<AuditEntry> {
  const filters = [];
  if (query.actorId) filters.push(eq(auditLog.actorId, query.actorId));
  if (query.action) filters.push(eq(auditLog.action, query.action));
  if (query.targetId) filters.push(eq(auditLog.targetId, query.targetId));
  if (query.from) filters.push(gte(auditLog.timestamp, new Date(query.from)));
  if (query.to) filters.push(lte(auditLog.timestamp, new Date(query.to)));

  const where = filters.length ? and(...filters) : undefined;
  const rows = db
    .select()
    .from(auditLog)
    .where(where)
    .orderBy(desc(auditLog.timestamp))
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize)
    .all();
  const total = db.select({ value: count() }).from(auditLog).where(where).get()?.value ?? 0;

  return paginate(rows.map(toEntry), query.page, query.pageSize, total);
}

function toEntry(row: AuditRow): AuditEntry {
  return {
    id: row.id,
    actorId: row.actorId,
    action: row.action,
    targetId: row.targetId,
    metadata: row.metadataJson ? (JSON.parse(row.metadataJson) as unknown) : null,
    timestamp: row.timestamp.toISOString(),
  };
}
