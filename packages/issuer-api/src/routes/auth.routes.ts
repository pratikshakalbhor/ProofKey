import { Router } from 'express';
import type { LoginInput } from '../dto/auth.js';
import { loginSchema } from '../dto/auth.js';
import { AppError } from '../lib/errors.js';
import { asyncHandler } from '../middleware/async.js';
import { requireAuth } from '../middleware/auth.js';
import { authRateLimiter } from '../middleware/rateLimit.js';
import { getBody, validateBody } from '../middleware/validate.js';
import { recordAudit } from '../services/audit.service.js';
import * as authService from '../services/auth.service.js';

const router: Router = Router();

router.post(
  '/login',
  authRateLimiter,
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = getBody<LoginInput>(req);
    const result = await authService.login(email, password);
    res.json(result);
  }),
);

router.post('/logout', requireAuth, (req, res) => {
  recordAudit(req.auth!.sub, 'auth.logout', req.auth!.sub, { email: req.auth!.email });
  res.status(204).send();
});

router.get('/me', requireAuth, (req, res) => {
  const admin = authService.getAdminById(req.auth!.sub);
  if (!admin) throw AppError.unauthorized('Session is no longer valid');
  res.json({
    admin: {
      id: admin.id,
      email: admin.email,
      role: admin.role,
      institutionId: admin.institutionId,
      createdAt: admin.createdAt.toISOString(),
    },
  });
});

export { router as authRouter };
