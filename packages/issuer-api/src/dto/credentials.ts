import { z } from 'zod';
import { paginationSchema } from './common.js';

export const CREDENTIAL_STATUSES = ['issued', 'delivered', 'revoked'] as const;

export const issueCredentialSchema = z.object({
  studentId: z.string().min(1),
  schemaId: z.string().min(1),
  issuedAt: z.string().optional(),
  expiresAt: z.string().optional(),
  /** Overrides the credential's `degree` field (defaults to the student's program). */
  degree: z.string().min(1).max(120).optional(),
  /** TTL for the holder claim link, in days. */
  deliveryTtlDays: z.coerce.number().int().min(1).max(365).optional(),
});

export type IssueCredentialInput = z.infer<typeof issueCredentialSchema>;

export const bulkIssueSchema = z.object({
  studentIds: z.array(z.string().min(1)).min(1).max(500),
  schemaId: z.string().min(1),
  issuedAt: z.string().optional(),
  expiresAt: z.string().optional(),
  degree: z.string().min(1).max(120).optional(),
  deliveryTtlDays: z.coerce.number().int().min(1).max(365).optional(),
});

export type BulkIssueInput = z.infer<typeof bulkIssueSchema>;

export const listCredentialsQuerySchema = paginationSchema.extend({
  status: z.enum(CREDENTIAL_STATUSES).optional(),
  studentId: z.string().min(1).optional(),
  schemaId: z.string().min(1).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export type ListCredentialsQuery = z.infer<typeof listCredentialsQuerySchema>;

export const revokeCredentialSchema = z.object({
  reason: z.string().min(3).max(500),
});

export type RevokeCredentialInput = z.infer<typeof revokeCredentialSchema>;

export const deliveryQrQuerySchema = z.object({
  /** Public base URL the holder's wallet will open. Defaults to the request origin. */
  baseUrl: z.string().url().optional(),
  ttlDays: z.coerce.number().int().min(1).max(365).optional(),
});

export type DeliveryQrQuery = z.infer<typeof deliveryQrQuerySchema>;
