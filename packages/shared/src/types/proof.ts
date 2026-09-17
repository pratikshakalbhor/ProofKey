import { z } from 'zod';

export const ProofStatusSchema = z.enum(['valid', 'invalid', 'revoked', 'pending']);

export const ProofRequestSchema = z.object({
  credentialId: z.string(),
  claimType: z.enum(['degree', 'license', 'id']),
});

export const ProofResultSchema = z.object({
  valid: z.boolean(),
  status: ProofStatusSchema,
  proofId: z.string(),
  credentialId: z.string(),
  claimType: z.enum(['degree', 'license', 'id']),
  verifiedAt: z.string().datetime(),
  txId: z.string().optional(),
  publicOutput: z.object({
    proofValid: z.boolean(),
  }),
});

export type ProofStatus = z.infer<typeof ProofStatusSchema>;
export type ProofRequest = z.infer<typeof ProofRequestSchema>;
export type ProofResult = z.infer<typeof ProofResultSchema>;