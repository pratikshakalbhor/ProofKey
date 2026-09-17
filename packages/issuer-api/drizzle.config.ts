import { defineConfig } from 'drizzle-kit';

/**
 * Drizzle Kit config. The runtime uses the idempotent migration in
 * `src/db/migrate.ts`; this file powers `pnpm db:generate` / `pnpm db:push`
 * when evolving the schema.
 */
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DATABASE_PATH ?? './data/issuer.sqlite',
  },
});
