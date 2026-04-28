/**
 * PPR ingestion cron job.
 *
 * Schedule: Sunday 02:00 UTC (see vercel.json)
 *
 * Triggered by:
 *   - Vercel Cron in production
 *   - Manual `curl http://localhost:3000/api/cron/ppr-ingest -H "Authorization: Bearer $CRON_SECRET"` in dev
 *
 * Authorization is enforced by checking the `Authorization: Bearer ${CRON_SECRET}` header.
 * Vercel Cron automatically includes this when invoking, using the value from
 * environment variables.
 */

import { NextResponse } from 'next/server';
// import { ppr } from '@properdata/scrapers';

export const runtime = 'nodejs';
// PPR ingestion can take 2-5 minutes on a full file diff.
// Vercel Pro plan allows up to 300s for serverless functions.
export const maxDuration = 300;

export async function GET(request: Request) {
  // Verify the cron secret to prevent external invocation
  const authHeader = request.headers.get('Authorization');
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // TODO: implement in Sprint 1
    // const result = await ppr.ingestPpr();
    const result = { totalRows: 0, newRows: 0, duplicates: 0, errors: 0 };

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
