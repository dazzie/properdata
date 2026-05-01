/**
 * PPR ingestion cron job.
 *
 * Schedule: Sunday 02:00 UTC (see vercel.json)
 *
 * Triggered by:
 *   - Vercel Cron in production
 *   - Manual `curl http://localhost:3000/api/cron/ppr-ingest -H "Authorization: Bearer $CRON_SECRET"` in dev
 */

import { NextResponse } from 'next/server';
import { ppr } from '@properdata/scrapers';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization');
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await ppr.ingestPpr();

    return NextResponse.json({
      status: 'ok',
      pipeline: 'ppr-ingest',
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('PPR ingest failed', error);
    return NextResponse.json(
      {
        status: 'error',
        pipeline: 'ppr-ingest',
        error: (error as Error).message,
      },
      { status: 500 },
    );
  }
}
