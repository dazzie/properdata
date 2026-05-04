import { NextRequest, NextResponse } from 'next/server';
import { authenticateMasterKey } from '../auth';
import { getSQL } from '../../property/db';

export async function GET(request: NextRequest) {
  const authResult = authenticateMasterKey(request);
  if ('error' in authResult) return authResult.error;

  const params = request.nextUrl.searchParams;
  const apiKeyId = params.get('api_key_id');
  if (!apiKeyId) {
    return NextResponse.json({ error: 'api_key_id is required' }, { status: 400 });
  }

  const limit = Math.min(Number(params.get('limit')) || 50, 200);
  const offset = Math.max(Number(params.get('offset')) || 0, 0);

  const sql = getSQL();

  const [keyRows, usageRows, countRows] = await Promise.all([
    sql(
      `SELECT id, key_prefix, name, credits_remaining, credits_purchased, tier,
              rate_limit_per_minute, is_active, last_used_at, created_at
       FROM api_keys WHERE id = $1`,
      [apiKeyId],
    ),
    sql(
      `SELECT id, endpoint, credits_used, response_status, latency_ms, ip_address, created_at
       FROM api_usage WHERE api_key_id = $1
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [apiKeyId, limit, offset],
    ),
    sql(
      'SELECT count(*) as total FROM api_usage WHERE api_key_id = $1',
      [apiKeyId],
    ) as unknown as Promise<Array<{ total: string }>>,
  ]);

  if (keyRows.length === 0) {
    return NextResponse.json({ error: 'API key not found' }, { status: 404 });
  }

  return NextResponse.json({
    key: keyRows[0],
    usage: usageRows,
    total: Number(countRows[0]?.total ?? 0),
    limit,
    offset,
  });
}
