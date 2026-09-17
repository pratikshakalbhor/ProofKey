import { Router } from 'express';
import { auditRouter } from './audit.routes.js';
import { authRouter } from './auth.routes.js';
import { credentialSchemasRouter } from './credential-schemas.routes.js';
import { credentialsRouter } from './credentials.routes.js';
import { institutionRouter } from './institution.routes.js';
import { ledgerRouter } from './ledger.routes.js';
import { studentsRouter } from './students.routes.js';

export const apiRouter: Router = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/institution', institutionRouter);
apiRouter.use('/students', studentsRouter);
apiRouter.use('/schemas', credentialSchemasRouter);
apiRouter.use('/credentials', credentialsRouter);
apiRouter.use('/audit-log', auditRouter);
apiRouter.use('/ledger', ledgerRouter);
