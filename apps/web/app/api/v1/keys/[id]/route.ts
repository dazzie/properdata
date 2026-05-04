import { NextRequest, NextResponse } from 'next/server';
import { authenticateMasterKey } from '../../auth';
import { getSQL } from '../../../property/db';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = authenticateMasterKey(request);
  if ('error' in authResult) return authResult.error;

  const { id } = await params;
  const body = await request.json() as Record<string, unknown>;

  const sets: string[] = [];
  const args: unknown[] = [];
  let idx = 1;

  if (body.is_active != null) {
    sets.push(`is_active = $${idx}`);
    args.push(Boolean(body.is_active));
    idx++;
  }
  if (body.name) {
    sets.push(`name = $${idx}`);
    args.push(body.name);
    idx++;
  }
  if (body.rate_limit_per_minute != null) {
    sets.push(`rate_limit_per_minute = $${idx}`);
    args.push(Number(body.rate_limit_per_minute));
    idx++;
  }
  if (body.credits_remaining != null) {
    sets.push(`credits_remaining = $${idx}`);
    args.push(Number(body.credits_remaining));
    idx++;
  }

  if (sets.length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  args.push(id);
  const sql = getSQL();
  const rows = await sql(
    `UPDATE api_keys SET ${sets.join(', ')} WHERE id = $${idx}
     RETURNING id, key_prefix, name, credits_remaining, credits_purchased,
               rate_limit_per_minute, is_active, last_used_at, created_at`,
    args,
  );

  if (rows.length === 0) {
    return NextResponse.json({ error: 'API key not found' }, { status: 404 });
  }

  return NextResponse.json(rows[0]);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = authenticateMasterKey(request);
  if ('error' in authResult) return authResult.error;

  const { id } = await params;
  const sql = getSQL();
  const rows = await sql(
    'UPDATE api_keys SET is_active = false WHERE id = $1 RETURNING id, key_prefix',
    [id],
  );

  if (rows.length === 0) {
    return NextResponse.json({ error: 'API key not found' }, { status: 404 });
  }

  return NextResponse.json({ revoked: true, ...rows[0] });
}
