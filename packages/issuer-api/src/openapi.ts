import { config } from './config.js';

/**
 * Hand-written OpenAPI 3.0 document served at `/docs` (Swagger UI) and
 * `/openapi.json`.
 */

const errorResponse = {
  description: 'Error',
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/Error' },
    },
  },
};

const unauthorized = { ...errorResponse, description: 'Authentication required' };
const forbidden = { ...errorResponse, description: 'Insufficient role' };
const notFound = { ...errorResponse, description: 'Not found' };

function jsonBody(schemaRef: string) {
  return {
    required: true,
    content: { 'application/json': { schema: { $ref: schemaRef } } },
  };
}

function ok(schemaRef: string) {
  return {
    description: 'Success',
    content: { 'application/json': { schema: { $ref: schemaRef } } },
  };
}

export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'VeriShield Issuer API',
    version: '0.1.0',
    description:
      'Internal credential-issuing system for a university. Issues privacy-preserving ' +
      'credentials whose commitments are anchored on Midnight. Never exposes the ' +
      'institution private key or the credential payload.',
  },
  servers: [{ url: `http://localhost:${config.port}` }],
  tags: [
    { name: 'Auth' },
    { name: 'Institution' },
    { name: 'Students' },
    { name: 'Schemas' },
    { name: 'Credentials' },
    { name: 'Audit' },
    { name: 'Ledger' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              details: {},
            },
            required: ['code', 'message'],
          },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
        },
      },
      LoginResponse: {
        type: 'object',
        properties: {
          token: { type: 'string' },
          admin: { $ref: '#/components/schemas/Admin' },
          institution: { $ref: '#/components/schemas/InstitutionRef' },
        },
      },
      Admin: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          email: { type: 'string' },
          role: { type: 'string', enum: ['admin', 'registrar', 'viewer'] },
          institutionId: { type: 'string' },
        },
      },
      InstitutionRef: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          type: { type: 'string' },
        },
      },
      Point: {
        type: 'object',
        properties: { x: { type: 'string' }, y: { type: 'string' } },
      },
      Institution: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          type: { type: 'string' },
          publicKey: { $ref: '#/components/schemas/Point' },
          midnightTxId: { type: 'string', nullable: true },
          logoUrl: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          network: { type: 'string' },
          contractAddress: { type: 'string', nullable: true },
        },
      },
      Student: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          institutionId: { type: 'string' },
          rollNumber: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string' },
          dob: { type: 'string' },
          program: { type: 'string' },
          graduationYear: { type: 'integer' },
          cgpa: { type: 'number' },
          status: { type: 'string', enum: ['active', 'graduated', 'suspended', 'withdrawn'] },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      CreateStudentRequest: {
        type: 'object',
        required: ['rollNumber', 'name', 'email', 'dob', 'program', 'graduationYear', 'cgpa'],
        properties: {
          rollNumber: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          dob: { type: 'string', description: 'ISO date' },
          program: { type: 'string' },
          graduationYear: { type: 'integer' },
          cgpa: { type: 'number', minimum: 0, maximum: 10 },
          status: { type: 'string', enum: ['active', 'graduated', 'suspended', 'withdrawn'] },
        },
      },
      SchemaField: {
        type: 'object',
        required: ['name', 'type'],
        properties: {
          name: { type: 'string' },
          type: { type: 'string', enum: ['string', 'number', 'date', 'boolean', 'bytes32'] },
          required: { type: 'boolean', default: true },
        },
      },
      CreateSchemaRequest: {
        type: 'object',
        required: ['name', 'version', 'fields'],
        properties: {
          name: { type: 'string' },
          version: { type: 'string' },
          fields: { type: 'array', items: { $ref: '#/components/schemas/SchemaField' } },
        },
      },
      SerializedCredential: {
        type: 'object',
        description:
          'Wire-safe credential handed to the holder exactly once. Contains the private ' +
          'payload; never send it to a verifier.',
        properties: {
          version: { type: 'integer', enum: [1] },
          payload: { type: 'object' },
          salt: { type: 'string' },
          commitment: { type: 'string' },
          leaf: { type: 'string' },
          signature: { type: 'object' },
          disclosure: { type: 'object' },
        },
      },
      IssueCredentialRequest: {
        type: 'object',
        required: ['studentId', 'schemaId'],
        properties: {
          studentId: { type: 'string' },
          schemaId: { type: 'string' },
          issuedAt: { type: 'string', format: 'date-time' },
          expiresAt: { type: 'string', format: 'date-time' },
          degree: { type: 'string' },
          deliveryTtlDays: { type: 'integer', minimum: 1, maximum: 365 },
        },
      },
      RevokeCredentialRequest: {
        type: 'object',
        required: ['reason'],
        properties: { reason: { type: 'string', minLength: 3, maxLength: 500 } },
      },
      Ledger: {
        type: 'object',
        properties: {
          contractAddress: { type: 'string' },
          issuerCount: { type: 'integer' },
          verificationCount: { type: 'integer' },
          lastProofValid: { type: 'boolean' },
          revocationRoot: { type: 'string' },
          issuanceRoot: { type: 'string' },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/health': {
      get: { tags: ['Ledger'], security: [], summary: 'Health check', responses: { '200': { description: 'OK' } } },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        security: [],
        summary: 'Log in',
        requestBody: jsonBody('#/components/schemas/LoginRequest'),
        responses: { '200': ok('#/components/schemas/LoginResponse'), '401': unauthorized, '429': errorResponse },
      },
    },
    '/auth/logout': {
      post: { tags: ['Auth'], summary: 'Log out', responses: { '204': { description: 'Logged out' }, '401': unauthorized } },
    },
    '/auth/me': {
      get: { tags: ['Auth'], summary: 'Current admin', responses: { '200': ok('#/components/schemas/Admin'), '401': unauthorized } },
    },
    '/institution': {
      get: { tags: ['Institution'], summary: 'Get institution', responses: { '200': ok('#/components/schemas/Institution'), '401': unauthorized } },
    },
    '/institution/keys/status': {
      get: { tags: ['Institution'], summary: 'Signing key status', responses: { '200': { description: 'OK' }, '401': unauthorized } },
    },
    '/institution/register-on-chain': {
      post: {
        tags: ['Institution'],
        summary: 'Anchor the institution verifying key on Midnight (admin)',
        requestBody: jsonBody('#/components/schemas/RevokeCredentialRequest'),
        responses: { '200': { description: 'Anchored' }, '401': unauthorized, '403': forbidden },
      },
    },
    '/students': {
      get: {
        tags: ['Students'],
        summary: 'List students (paginated, searchable)',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer' } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer' } },
          { name: 'q', in: 'query', schema: { type: 'string' } },
          { name: 'program', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'OK' }, '401': unauthorized },
      },
      post: {
        tags: ['Students'],
        summary: 'Create a student (registrar)',
        requestBody: jsonBody('#/components/schemas/CreateStudentRequest'),
        responses: { '201': ok('#/components/schemas/Student'), '401': unauthorized, '403': forbidden, '409': errorResponse },
      },
    },
    '/students/bulk-import': {
      post: {
        tags: ['Students'],
        summary: 'CSV bulk import (registrar)',
        description: 'Send `text/csv` or JSON `{ "csv": "..." }`. Returns a row-level validation report.',
        requestBody: { required: true, content: { 'text/csv': { schema: { type: 'string' } }, 'application/json': { schema: { type: 'object', properties: { csv: { type: 'string' } } } } } },
        responses: { '201': { description: 'Imported with report' }, '401': unauthorized, '403': forbidden },
      },
    },
    '/students/{id}': {
      get: {
        tags: ['Students'],
        summary: 'Get a student',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': ok('#/components/schemas/Student'), '401': unauthorized, '404': notFound },
      },
    },
    '/schemas': {
      get: { tags: ['Schemas'], summary: 'List credential schemas', responses: { '200': { description: 'OK' }, '401': unauthorized } },
      post: {
        tags: ['Schemas'],
        summary: 'Create a credential schema (registrar)',
        requestBody: jsonBody('#/components/schemas/CreateSchemaRequest'),
        responses: { '201': { description: 'Created' }, '401': unauthorized, '403': forbidden, '409': errorResponse },
      },
    },
    '/schemas/{id}': {
      get: {
        tags: ['Schemas'],
        summary: 'Get a credential schema',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'OK' }, '401': unauthorized, '404': notFound },
      },
    },
    '/credentials': {
      get: {
        tags: ['Credentials'],
        summary: 'List credentials (filter by status/student/schema/date)',
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['issued', 'delivered', 'revoked'] } },
          { name: 'studentId', in: 'query', schema: { type: 'string' } },
          { name: 'from', in: 'query', schema: { type: 'string' } },
          { name: 'to', in: 'query', schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'OK' }, '401': unauthorized },
      },
    },
    '/credentials/issue': {
      post: {
        tags: ['Credentials'],
        summary: 'Issue a credential (registrar)',
        requestBody: jsonBody('#/components/schemas/IssueCredentialRequest'),
        responses: { '201': { description: 'Issued; returns credential + serialized material' }, '401': unauthorized, '403': forbidden },
      },
    },
    '/credentials/bulk-issue': {
      post: {
        tags: ['Credentials'],
        summary: 'Issue to many students (registrar)',
        requestBody: jsonBody('#/components/schemas/IssueCredentialRequest'),
        responses: { '201': { description: 'Bulk result' }, '401': unauthorized, '403': forbidden },
      },
    },
    '/credentials/claim': {
      get: {
        tags: ['Credentials'],
        security: [],
        summary: 'Exchange a claim token for credential material',
        parameters: [{ name: 'token', in: 'query', required: true, schema: { type: 'string' } }],
        responses: { '200': ok('#/components/schemas/SerializedCredential'), '400': errorResponse, '401': unauthorized, '404': notFound },
      },
    },
    '/credentials/{id}': {
      get: {
        tags: ['Credentials'],
        summary: 'Get a credential',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'OK' }, '401': unauthorized, '404': notFound },
      },
    },
    '/credentials/{id}/delivery-qr': {
      get: {
        tags: ['Credentials'],
        summary: 'One-time claim link + QR',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'baseUrl', in: 'query', schema: { type: 'string', format: 'uri' } },
          { name: 'ttlDays', in: 'query', schema: { type: 'integer' } },
        ],
        responses: { '200': { description: 'Claim URL + QR data URL' }, '401': unauthorized, '404': notFound },
      },
    },
    '/credentials/{id}/revoke': {
      post: {
        tags: ['Credentials'],
        summary: 'Revoke a credential and republish the revocation root (admin)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: jsonBody('#/components/schemas/RevokeCredentialRequest'),
        responses: { '200': { description: 'Revoked' }, '401': unauthorized, '403': forbidden, '409': errorResponse },
      },
    },
    '/credentials/{id}/revocation-status': {
      get: {
        tags: ['Credentials'],
        summary: 'Revocation status + non-membership proof',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'OK' }, '401': unauthorized, '404': notFound },
      },
    },
    '/audit-log': {
      get: {
        tags: ['Audit'],
        summary: 'Paginated audit log (admin)',
        responses: { '200': { description: 'OK' }, '401': unauthorized, '403': forbidden },
      },
    },
    '/ledger': {
      get: {
        tags: ['Ledger'],
        security: [],
        summary: 'Public on-chain registry state',
        responses: { '200': ok('#/components/schemas/Ledger') },
      },
    },
  },
} as const;

export type OpenApiDocument = typeof openApiDocument;
