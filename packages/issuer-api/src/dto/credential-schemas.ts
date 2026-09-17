import { z } from 'zod';
import { paginationSchema } from './common.js';

export const schemaFieldSchema = z.object({
  name: z.string().min(1).max(64),
  type: z.enum(['string', 'number', 'date', 'boolean', 'bytes32']),
  required: z.boolean().default(true),
});

export const createCredentialSchemaSchema = z.object({
  name: z.string().min(1).max(120),
  version: z.string().min(1).max(32),
  fields: z.array(schemaFieldSchema).min(1),
});

export type CreateCredentialSchemaInput = z.infer<typeof createCredentialSchemaSchema>;

export const listSchemasQuerySchema = paginationSchema.extend({
  name: z.string().trim().min(1).optional(),
});

export type ListSchemasQuery = z.infer<typeof listSchemasQuerySchema>;
