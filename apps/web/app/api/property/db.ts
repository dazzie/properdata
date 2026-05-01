import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

let _sql: NeonQueryFunction<false, false> | null = null;

function loadEnvFallback() {
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
    // fallback not found
  }
}

export function getSQL() {
  if (!_sql) {
    loadEnvFallback();
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not set');
    }
    _sql = neon(process.env.DATABASE_URL);
  }
  return _sql;
}
