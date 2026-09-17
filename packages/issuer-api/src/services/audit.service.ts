import { nanoid } from 'nanoid';
import { db } from '../db/client.js';
import { auditLog } from '../db/schema.js';
import { stringifyBigInts } from '../lib/json.js';

/**
 * Append-only audit trail. Every mutation records who did what to which row.
 * Never pass credential payloads / private keys in `metadata`.
 */
export function recordAudit(
  actorId: string | null,
  action: string,
  targetId?: string,
  metadata?: unknown,
): void {
  db.insert(auditLog)
    .values({
      id: `aud_${nanoid(16)}`,
      actorId: actorId ?? null,
      action,
      targetId: targetId ?? null,
      metadataJson: metadata === undefined ? null : stringifyBigInts(metadata),
      timestamp: new Date(),
    })
    .run();
}
