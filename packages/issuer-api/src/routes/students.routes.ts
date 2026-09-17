import express, { Router } from 'express';
import { idParamSchema } from '../dto/common.js';
import type { CreateStudentInput, ListStudentsQuery } from '../dto/students.js';
import { createStudentSchema, listStudentsQuerySchema } from '../dto/students.js';
import { AppError } from '../lib/errors.js';
import { asyncHandler } from '../middleware/async.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { getBody, getParams, getQuery, validateBody, validateParams, validateQuery } from '../middleware/validate.js';
import {
  bulkImportStudents,
  createStudent,
  getStudent,
  listStudents,
} from '../services/student.service.js';

const router: Router = Router();

router.get('/', requireAuth, validateQuery(listStudentsQuerySchema), (req, res) => {
  res.json(listStudents(req.auth!.institutionId, getQuery<ListStudentsQuery>(req)));
});

router.post(
  '/',
  requireAuth,
  requireRole('registrar'),
  validateBody(createStudentSchema),
  (req, res) => {
    const student = createStudent(
      req.auth!.institutionId,
      getBody<CreateStudentInput>(req),
      req.auth!.sub,
    );
    res.status(201).json({ data: student });
  },
);

router.post(
  '/bulk-import',
  requireAuth,
  requireRole('registrar'),
  express.text({ type: ['text/csv', 'text/plain', 'application/csv'], limit: '2mb' }),
  asyncHandler(async (req, res) => {
    const body = req.body as unknown;
    const csv =
      typeof body === 'string' && body.trim().length > 0
        ? body
        : (body as { csv?: string } | undefined)?.csv;
    if (!csv) {
      throw AppError.badRequest('Provide CSV content as text/csv or JSON { "csv": "..." }');
    }
    const result = bulkImportStudents(req.auth!.institutionId, csv, req.auth!.sub);
    res.status(201).json({
      report: result.report,
      inserted: result.inserted.length,
      skipped: result.skipped,
    });
  }),
);

router.get('/:id', requireAuth, validateParams(idParamSchema), (req, res) => {
  res.json({ data: getStudent(req.auth!.institutionId, getParams<{ id: string }>(req).id) });
});

export { router as studentsRouter };
