import { Router } from 'express';
import { asyncHandler } from '../middleware/async.js';
import { readLedger } from '../services/midnight.service.js';

/** Public, PII-free view of the on-chain registry state. */
const router: Router = Router();

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json({ data: await readLedger() });
  }),
);

export { router as ledgerRouter };
