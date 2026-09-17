import cors from 'cors';
import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { config } from './config.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { openApiDocument } from './openapi.js';
import { apiRouter } from './routes/index.js';

export function createApp(): express.Express {
  const app = express();
  app.disable('x-powered-by');

  app.use(cors({ origin: config.corsOrigin, credentials: true }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      network: config.networkId,
      contractAddress: config.contractAddress ?? null,
    });
  });

  app.get('/openapi.json', (_req, res) => {
    res.json(openApiDocument);
  });
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument, { customSiteTitle: 'VeriShield Issuer API' }));

  app.use(apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
