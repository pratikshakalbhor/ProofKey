import { parse } from 'csv-parse/sync';
import type { ZodTypeAny, z } from 'zod';

/**
 * CSV parsing + row-level validation report.
 * Used by `POST /students/bulk-import`.
 */

export interface CsvRowError {
  row: number;
  errors: Record<string, string[]>;
  raw: Record<string, string>;
}

export interface CsvValidationReport<T> {
  total: number;
  valid: T[];
  invalid: CsvRowError[];
}

export function parseAndValidateCsv<TSchema extends ZodTypeAny>(
  content: string,
  schema: TSchema,
): CsvValidationReport<z.infer<TSchema>> {
  let rows: Record<string, string>[];
  try {
    rows = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
      relax_column_count: true,
    }) as Record<string, string>[];
  } catch (error) {
    throw new Error(`CSV could not be parsed: ${(error as Error).message}`, { cause: error });
  }

  const report: CsvValidationReport<z.infer<TSchema>> = {
    total: rows.length,
    valid: [],
    invalid: [],
  };

  rows.forEach((raw, index) => {
    // +2 accounts for the header row and 1-based line numbering.
    const line = index + 2;
    const result = schema.safeParse(raw);
    if (result.success) {
      report.valid.push(result.data);
    } else {
      const errors: Record<string, string[]> = {};
      for (const issue of result.error.issues) {
        const key = issue.path.join('.') || '_row';
        (errors[key] ??= []).push(issue.message);
      }
      report.invalid.push({ row: line, errors, raw });
    }
  });

  return report;
}
