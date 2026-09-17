import { Router } from 'express';
import type { ListAuditQuery } from '../dto/audit.js';
import { listAuditQuerySchema } from '../dto/audit.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { getQuery, validateQuery } from '../middleware/validate.js';
import { listAuditLog } from '../services/audit-log.service.js';

const router: Router = Router();

router.use(requireAuth, requireRole('admin'));

router.get('/', validateQuery(listAuditQuerySchema), (req, res) => {
  res.json(listAuditLog(getQuery<ListAuditQuery>(req)));
});

export { router as auditRouter };
