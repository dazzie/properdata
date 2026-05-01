import 'server-only';

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { neon, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { schema } from './schema';

neonConfig.fetchConnectionCache = true;

function tryLoadEnvFromLocalFile(): void {
  if (process.env.DATABASE_URL) return;
  try {
    const envPath = resolve(process.cwd(), '../../.env.local');
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      if (line.startsWith('#') || !line.includes('=')) continue;
      const eqIdx = line.indexOf('=');
      const key = line.slice(0, eqIdx).trim();
      const val = line.slice(eqIdx + 1).trim();
      if (key && !process.env[key]) {
        process.env[key] = val;
      }
    }
  } catch {
    // .env.local not found
  }
}

function getConnectionString(): string {
  tryLoadEnvFromLocalFile();
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set');
  }
  return url;
}

function createDb() {
  const sql = neon(getConnectionString());
  return drizzle(sql, { schema, casing: 'snake_case' });
}

type DrizzleDb = ReturnType<typeof createDb>;

let _db: DrizzleDb | undefined;

function getDb(): DrizzleDb {
  if (!_db) {
    _db = createDb();
  }
  return _db;
}

/**
 * Lazy DB: `next build` imports API route modules before env is guaranteed;
 * connection is only created on first use (runtime / `next dev`).
 */
export const db = new Proxy({} as DrizzleDb, {
  get(_target, prop, receiver) {
    const instance = getDb();
    const value = Reflect.get(instance as object, prop, receiver);
    if (typeof value === 'function') {
      return value.bind(instance);
    }
    return value;
  },
}) as DrizzleDb;

export type Database = DrizzleDb;
