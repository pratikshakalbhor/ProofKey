import { z } from 'zod';
import { paginationSchema } from './common.js';

export const STUDENT_STATUSES = ['active', 'graduated', 'suspended', 'withdrawn'] as const;

export const createStudentSchema = z.object({
  rollNumber: z.string().min(1).max(32),
  name: z.string().min(1).max(120),
  email: z.string().email(),
  dob: z.string().min(4).max(32),
  program: z.string().min(1).max(120),
  graduationYear: z.coerce.number().int().min(1950).max(2100),
  cgpa: z.coerce.number().min(0).max(10),
  status: z.enum(STUDENT_STATUSES).optional(),
});

export type CreateStudentInput = z.infer<typeof createStudentSchema>;

/** One CSV row: every value arrives as a string, coerced by createStudentSchema. */
export const csvStudentRowSchema = createStudentSchema;

export const listStudentsQuerySchema = paginationSchema.extend({
  q: z.string().trim().min(1).optional(),
  program: z.string().trim().min(1).optional(),
  status: z.enum(STUDENT_STATUSES).optional(),
  graduationYear: z.coerce.number().int().optional(),
  sort: z.enum(['name', 'rollNumber', 'cgpa', 'createdAt']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export type ListStudentsQuery = z.infer<typeof listStudentsQuerySchema>;
