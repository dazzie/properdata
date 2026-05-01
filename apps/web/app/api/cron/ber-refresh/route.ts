/**
 * BER ingestion cron job.
 *
 * Schedule: 1st of every month at 03:00 UTC (see vercel.json)
 */

import { NextResponse } from 'next/server';
import { ber } from '@properdata/scrapers';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization');
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await ber.ingestBer();

    return NextResponse.json({
      status: 'ok',
      pipeline: 'ber-refresh',
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('BER ingest failed', error);
    return NextResponse.json(
      {
        status: 'error',
        pipeline: 'ber-refresh',
        error: (error as Error).message,
      },
      { status: 500 },
    );
  }
}
