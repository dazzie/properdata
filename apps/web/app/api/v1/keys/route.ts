import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomBytes } from 'node:crypto';
import { authenticateMasterKey } from '../auth';
import { getSQL } from '../../property/db';

export async function POST(request: NextRequest) {
  const authResult = authenticateMasterKey(request);
  if ('error' in authResult) return authResult.error;

  const body = await request.json() as Record<string, unknown>;
  const name = body.name as string | undefined;
  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const rawKey = `pd_live_${randomBytes(16).toString('hex')}`;
  const keyHash = createHash('sha256').update(rawKey).digest('hex');
  const keyPrefix = rawKey.slice(0, 16);
  const credits = Number(body.credits) || 0;
  const rateLimit = Number(body.rate_limit_per_minute) || 60;
  const expiresAt = body.expires_at as string | null ?? null;

  const sql = getSQL();
  const rows = await sql(
    `INSERT INTO api_keys (key_hash, key_prefix, name, credits_remaining, credits_purchased, rate_limit_per_minute, expires_at)
     VALUES ($1, $2, $3, $4, $4, $5, $6)
     RETURNING id, key_prefix, name, credits_remaining, rate_limit_per_minute, created_at`,
    [keyHash, keyPrefix, name, credits, rateLimit, expiresAt],
  );

  return NextResponse.json({
    key: rawKey,
    ...rows[0],
  }, { status: 201 });
}

export async function GET(request: NextRequest) {
  const authResult = authenticateMasterKey(request);
  if ('error' in authResult) return authResult.error;

  const sql = getSQL();
  const rows = await sql(
    `SELECT id, key_prefix, name, credits_remaining, credits_purchased, tier,
            rate_limit_per_minute, is_active, last_used_at, created_at, expires_at
     FROM api_keys ORDER BY created_at DESC`,
  );

  return NextResponse.json({ keys: rows });
}
