import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { config } from '../config.js';
import * as schema from './schema.js';

/**
 * Single better-sqlite3 connection wrapped in Drizzle.
 *
 * better-sqlite3 is synchronous, which keeps the service layer free of
 * connection-pool complexity for the demo. WAL mode + foreign keys are on.
 */

const dbPath = resolve(config.databasePath);
mkdirSync(dirname(dbPath), { recursive: true });

export const sqlite: Database.Database = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });

export type DB = typeof db;
export { schema };
