/**
 * Daily materialised view refresh.
 *
 * Schedule: Daily 06:00 UTC (see vercel.json)
 *
 * Refreshes town_metrics materialised view via the SQL function created in
 * packages/db/migrations/0001_town_metrics.sql.
 */

import { NextResponse } from 'next/server';
import { db, sql } from '@properdata/db';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization');
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await db.execute(sql`SELECT refresh_town_metrics()`);

    return NextResponse.json({
      status: 'ok',
      pipeline: 'metrics-refresh',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Metrics refresh failed', error);
    return NextResponse.json(
      { status: 'error', error: (error as Error).message },
      { status: 500 },
    );
  }
}
