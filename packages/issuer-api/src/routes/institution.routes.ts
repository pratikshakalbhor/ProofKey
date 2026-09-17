import { Router } from 'express';
import { config } from '../config.js';
import type { RegisterOnChainInput } from '../dto/institution.js';
import { registerOnChainSchema } from '../dto/institution.js';
import type { Institution } from '../db/schema.js';
import { asyncHandler } from '../middleware/async.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { getBody, validateBody } from '../middleware/validate.js';
import {
  anchorIssuerOnChain,
  getInstitution,
  getKeyStatus,
} from '../services/institution.service.js';

const router: Router = Router();

/** Public projection of an institution row — never the encrypted private key. */
function toPublic(institution: Institution) {
  return {
    id: institution.id,
    name: institution.name,
    type: institution.type,
    publicKey: JSON.parse(institution.publicKey) as { x: string; y: string },
    midnightTxId: institution.midnightTxId,
    logoUrl: institution.logoUrl,
    createdAt: institution.createdAt.toISOString(),
    network: config.networkId,
    contractAddress: config.contractAddress ?? null,
  };
}

router.use(requireAuth);

router.get('/', (req, res) => {
  res.json({ data: toPublic(getInstitution(req.auth!.institutionId)) });
});

router.get('/keys/status', (req, res) => {
  res.json({ data: getKeyStatus(getInstitution(req.auth!.institutionId)) });
});

router.post(
  '/register-on-chain',
  requireRole('admin'),
  validateBody(registerOnChainSchema),
  asyncHandler(async (req, res) => {
    const { force } = getBody<RegisterOnChainInput>(req);
    const institution = getInstitution(req.auth!.institutionId);
    const result = await anchorIssuerOnChain(institution, req.auth!.sub, force);
    res.json({ data: result });
  }),
);

export { router as institutionRouter };
