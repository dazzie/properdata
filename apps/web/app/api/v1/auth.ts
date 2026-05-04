import 'server-only';
import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getSQL } from '../property/db';

export interface ApiKeyRow {
  id: number;
  subscriber_id: number | null;
  key_hash: string;
  key_prefix: string;
  name: string;
  credits_remaining: number;
  credits_purchased: number;
  tier: string;
  rate_limit_per_minute: number;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
  expires_at: string | null;
}

type AuthSuccess = { key: ApiKeyRow };
type AuthFailure = { error: NextResponse };

export async function authenticateApiKey(
  request: NextRequest,
): Promise<AuthSuccess | AuthFailure> {
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer pd_live_')) {
    return {
      error: NextResponse.json(
        { error: 'Missing or malformed API key. Use Authorization: Bearer pd_live_...' },
        { status: 401 },
      ),
    };
  }

  const token = auth.slice(7);
  const hash = createHash('sha256').update(token).digest('hex');
  const sql = getSQL();

  const rows = await sql('SELECT * FROM api_keys WHERE key_hash = $1', [hash]) as ApiKeyRow[];
  if (rows.length === 0) {
    return { error: NextResponse.json({ error: 'Invalid API key' }, { status: 401 }) };
  }

  const key = rows[0]!;

  if (!key.is_active) {
    return { error: NextResponse.json({ error: 'API key has been revoked' }, { status: 403 }) };
  }
  if (key.expires_at && new Date(key.expires_at) < new Date()) {
    return { error: NextResponse.json({ error: 'API key has expired' }, { status: 403 }) };
  }
  if (key.credits_remaining <= 0) {
    return {
      error: NextResponse.json(
        { error: 'No credits remaining. Purchase more at /dashboard' },
        { status: 403 },
      ),
    };
  }

  const rateCheck = await sql(
    `SELECT count(*) as cnt FROM api_usage WHERE api_key_id = $1 AND created_at > NOW() - INTERVAL '1 minute'`,
    [key.id],
  ) as Array<{ cnt: string }>;
  if (Number(rateCheck[0]?.cnt ?? 0) >= key.rate_limit_per_minute) {
    return {
      error: NextResponse.json(
        { error: `Rate limit exceeded. Maximum ${key.rate_limit_per_minute} requests per minute.` },
        { status: 429, headers: { 'Retry-After': '60' } },
      ),
    };
  }

  sql('UPDATE api_keys SET last_used_at = NOW() WHERE id = $1', [key.id]).catch(() => {});

  return { key };
}

export function authenticateMasterKey(
  request: NextRequest,
): { ok: true } | { error: NextResponse } {
  const masterKey = process.env.API_MASTER_KEY;
  if (!masterKey) {
    return { error: NextResponse.json({ error: 'API management not configured' }, { status: 503 }) };
  }

  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${masterKey}`) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  return { ok: true };
}

export async function logUsage(
  apiKeyId: number,
  endpoint: string,
  params: unknown,
  status: number,
  latencyMs: number,
  ip: string | null,
  creditsUsed: number,
): Promise<void> {
  const sql = getSQL();
  await sql(
    `INSERT INTO api_usage (api_key_id, endpoint, request_params, response_status, latency_ms, ip_address, credits_used)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [apiKeyId, endpoint, JSON.stringify(params), status, latencyMs, ip, creditsUsed],
  ).catch(() => {});
}

export async function deductCredit(apiKeyId: number): Promise<boolean> {
  const sql = getSQL();
  const result = await sql(
    'UPDATE api_keys SET credits_remaining = credits_remaining - 1 WHERE id = $1 AND credits_remaining > 0 RETURNING credits_remaining',
    [apiKeyId],
  );
  return result.length > 0;
}
