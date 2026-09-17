import { and, asc, count, desc, eq, like, or } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/client.js';
import { students, type Student } from '../db/schema.js';
import { paginate, type Paginated } from '../dto/common.js';
import {
  csvStudentRowSchema,
  type CreateStudentInput,
  type ListStudentsQuery,
} from '../dto/students.js';
import { parseAndValidateCsv, type CsvValidationReport } from '../lib/csv.js';
import { AppError } from '../lib/errors.js';
import { recordAudit } from './audit.service.js';

const SORT_COLUMNS = {
  name: students.name,
  rollNumber: students.rollNumber,
  cgpa: students.cgpa,
  createdAt: students.createdAt,
} as const;

export function listStudents(institutionId: string, query: ListStudentsQuery): Paginated<Student> {
  const filters = [eq(students.institutionId, institutionId)];
  if (query.q) {
    filters.push(
      or(
        like(students.name, `%${query.q}%`),
        like(students.rollNumber, `%${query.q}%`),
        like(students.email, `%${query.q}%`),
      )!,
    );
  }
  if (query.program) filters.push(eq(students.program, query.program));
  if (query.status) filters.push(eq(students.status, query.status));
  if (query.graduationYear) filters.push(eq(students.graduationYear, query.graduationYear));

  const where = and(...filters);
  const orderBy = query.order === 'asc' ? asc(SORT_COLUMNS[query.sort]) : desc(SORT_COLUMNS[query.sort]);

  const rows = db
    .select()
    .from(students)
    .where(where)
    .orderBy(orderBy)
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize)
    .all();
  const total = db.select({ value: count() }).from(students).where(where).get()?.value ?? 0;

  return paginate(rows, query.page, query.pageSize, total);
}

export function getStudent(institutionId: string, id: string): Student {
  const row = db
    .select()
    .from(students)
    .where(and(eq(students.id, id), eq(students.institutionId, institutionId)))
    .get();
  if (!row) throw AppError.notFound('Student not found');
  return row;
}

export function findStudentByRoll(
  institutionId: string,
  rollNumber: string,
): Student | undefined {
  return db
    .select()
    .from(students)
    .where(and(eq(students.institutionId, institutionId), eq(students.rollNumber, rollNumber)))
    .get();
}

export function createStudent(
  institutionId: string,
  input: CreateStudentInput,
  actorId: string | null,
): Student {
  if (findStudentByRoll(institutionId, input.rollNumber)) {
    throw AppError.conflict(`A student with roll number "${input.rollNumber}" already exists`);
  }
  const row: Student = {
    id: `stu_${nanoid(16)}`,
    institutionId,
    rollNumber: input.rollNumber,
    name: input.name,
    email: input.email.toLowerCase(),
    dob: input.dob,
    program: input.program,
    graduationYear: input.graduationYear,
    cgpa: input.cgpa,
    status: input.status ?? 'active',
    createdAt: new Date(),
  };
  db.insert(students).values(row).run();
  recordAudit(actorId, 'student.create', row.id, { rollNumber: row.rollNumber });
  return row;
}

export interface BulkImportResult {
  report: CsvValidationReport<CreateStudentInput>;
  inserted: Student[];
  skipped: { rollNumber: string; reason: string }[];
}

/** CSV bulk import with a per-row validation report. */
export function bulkImportStudents(
  institutionId: string,
  csvContent: string,
  actorId: string | null,
): BulkImportResult {
  const report = parseAndValidateCsv(csvContent, csvStudentRowSchema);
  const inserted: Student[] = [];
  const skipped: { rollNumber: string; reason: string }[] = [];

  for (const row of report.valid) {
    if (findStudentByRoll(institutionId, row.rollNumber)) {
      skipped.push({ rollNumber: row.rollNumber, reason: 'duplicate roll number' });
      continue;
    }
    inserted.push(createStudent(institutionId, row, actorId));
  }

  recordAudit(actorId, 'student.bulk-import', institutionId, {
    total: report.total,
    inserted: inserted.length,
    invalid: report.invalid.length,
    skipped: skipped.length,
  });

  return { report, inserted, skipped };
}
