import { Router } from 'express';
import { idParamSchema } from '../dto/common.js';
import type { CreateCredentialSchemaInput, ListSchemasQuery } from '../dto/credential-schemas.js';
import {
  createCredentialSchemaSchema,
  listSchemasQuerySchema,
} from '../dto/credential-schemas.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { getBody, getParams, getQuery, validateBody, validateParams, validateQuery } from '../middleware/validate.js';
import { createSchema, getSchema, listSchemas } from '../services/credential-schema.service.js';

const router: Router = Router();

router.use(requireAuth);

router.get('/', validateQuery(listSchemasQuerySchema), (req, res) => {
  res.json(listSchemas(getQuery<ListSchemasQuery>(req)));
});

router.post(
  '/',
  requireRole('registrar'),
  validateBody(createCredentialSchemaSchema),
  (req, res) => {
    const schema = createSchema(getBody<CreateCredentialSchemaInput>(req), req.auth!.sub);
    res.status(201).json({ data: schema });
  },
);

router.get('/:id', validateParams(idParamSchema), (req, res) => {
  res.json({ data: getSchema(getParams<{ id: string }>(req).id) });
});

export { router as credentialSchemasRouter };
