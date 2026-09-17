import { z } from 'zod';

export const CredentialTypeSchema = z.enum(['degree', 'license', 'id']);
export const CredentialStatusSchema = z.enum(['active', 'revoked', 'pending']);

export const DegreeSchema = z.object({
  level: z.enum(['bachelor', 'master', 'phd', 'diploma']),
  field: z.string(),
  grade: z.string(),
  honors: z.boolean(),
});

export const CredentialSchema = z.object({
  id: z.string().regex(/^cred_[a-z0-9_]+$/),
  credentialType: CredentialTypeSchema,
  status: CredentialStatusSchema,
  holderName: z.string(),
  issuerId: z.string(),
  issueDate: z.string().datetime(),
  degree: DegreeSchema.optional(),
  license: z.string().optional(),
  salt: z.string(),
  commitmentHash: z.string(),
  txId: z.string().optional(),
});

export type CredentialType = z.infer<typeof CredentialTypeSchema>;
export type CredentialStatus = z.infer<typeof CredentialStatusSchema>;
export type Degree = z.infer<typeof DegreeSchema>;
export type Credential = z.infer<typeof CredentialSchema>;