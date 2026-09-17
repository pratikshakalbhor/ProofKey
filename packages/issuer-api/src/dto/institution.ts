import { z } from 'zod';

export const registerOnChainSchema = z.object({
  /** Re-anchor even if a `midnightTxId` is already recorded. */
  force: z.boolean().default(false),
});

export type RegisterOnChainInput = z.infer<typeof registerOnChainSchema>;
