import { Router } from 'express';
import { idParamSchema } from '../dto/common.js';
import type {
  BulkIssueInput,
  DeliveryQrQuery,
  IssueCredentialInput,
  ListCredentialsQuery,
  RevokeCredentialInput,
} from '../dto/credentials.js';
import {
  bulkIssueSchema,
  deliveryQrQuerySchema,
  issueCredentialSchema,
  listCredentialsQuerySchema,
  revokeCredentialSchema,
} from '../dto/credentials.js';
import { config } from '../config.js';
import { AppError } from '../lib/errors.js';
import { asyncHandler } from '../middleware/async.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  getBody,
  getParams,
  getQuery,
  validateBody,
  validateParams,
  validateQuery,
} from '../middleware/validate.js';
import {
  claimCredential,
  getCredential,
  getCredentialRevocationStatus,
  getDelivery,
  issueCredential,
  listCredentials,
  revokeCredential,
  bulkIssue,
} from '../services/credential.service.js';
import { getInstitution } from '../services/institution.service.js';

const router: Router = Router();

/**
 * Public holder claim. The token is the only credential; no admin session.
 * Defined before `requireAuth` so the wallet can call it unauthenticated.
 */
const handleClaim = asyncHandler(async (req, res) => {
  const token =
    typeof req.query.token === 'string'
      ? req.query.token
      : (req.body as { token?: string } | undefined)?.token;
  if (!token) throw AppError.badRequest('A claim token is required');
  res.json({ data: await claimCredential(token) });
});

router.get('/claim', handleClaim);
router.post('/claim', handleClaim);

router.use(requireAuth);

router.get('/', validateQuery(listCredentialsQuerySchema), (req, res) => {
  res.json(listCredentials(req.auth!.institutionId, getQuery<ListCredentialsQuery>(req)));
});

router.post(
  '/issue',
  requireRole('registrar'),
  validateBody(issueCredentialSchema),
  asyncHandler(async (req, res) => {
    const institution = getInstitution(req.auth!.institutionId);
    const result = await issueCredential(institution, getBody<IssueCredentialInput>(req), req.auth!.sub);
    res.status(201).json({ data: result });
  }),
);

router.post(
  '/bulk-issue',
  requireRole('registrar'),
  validateBody(bulkIssueSchema),
  asyncHandler(async (req, res) => {
    const institution = getInstitution(req.auth!.institutionId);
    const result = await bulkIssue(institution, getBody<BulkIssueInput>(req), req.auth!.sub);
    res.status(201).json({ data: result });
  }),
);

router.get('/:id', validateParams(idParamSchema), (req, res) => {
  res.json({ data: getCredential(req.auth!.institutionId, getParams<{ id: string }>(req).id) });
});

router.get(
  '/:id/delivery-qr',
  validateParams(idParamSchema),
  validateQuery(deliveryQrQuerySchema),
  asyncHandler(async (req, res) => {
    const institution = getInstitution(req.auth!.institutionId);
    const { baseUrl, ttlDays } = getQuery<DeliveryQrQuery>(req);
    const result = await getDelivery(institution, getParams<{ id: string }>(req).id, {
      baseUrl: baseUrl ?? config.corsOrigin,
      ttlDays,
    });
    res.json({ data: result });
  }),
);

router.get('/:id/revocation-status', validateParams(idParamSchema), (req, res) => {
  res.json({
    data: getCredentialRevocationStatus(
      req.auth!.institutionId,
      getParams<{ id: string }>(req).id,
    ),
  });
});

router.post(
  '/:id/revoke',
  requireRole('admin'),
  validateParams(idParamSchema),
  validateBody(revokeCredentialSchema),
  asyncHandler(async (req, res) => {
    const institution = getInstitution(req.auth!.institutionId);
    const { reason } = getBody<RevokeCredentialInput>(req);
    const result = await revokeCredential(
      institution,
      getParams<{ id: string }>(req).id,
      reason,
      req.auth!.sub,
    );
    res.json({ data: result });
  }),
);

export { router as credentialsRouter };
