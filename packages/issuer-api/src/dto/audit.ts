import { z } from 'zod';
import { paginationSchema } from './common.js';

export const listAuditQuerySchema = paginationSchema.extend({
  actorId: z.string().min(1).optional(),
  action: z.string().min(1).optional(),
  targetId: z.string().min(1).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export type ListAuditQuery = z.infer<typeof listAuditQuerySchema>;
