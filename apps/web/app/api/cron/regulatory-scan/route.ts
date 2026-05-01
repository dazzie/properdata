/**
 * Regulatory monitor cron job.
 *
 * Schedule: daily at 07:00 UTC (see vercel.json)
 *
 * Checks key government pages for content changes. When a change is detected,
 * calls the Regulatory Monitor Agent (Haiku) to determine if it's material.
 */

import { NextResponse } from 'next/server';
import { regulatory } from '@properdata/scrapers';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization');
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await regulatory.checkRegulatoryPages();

    return NextResponse.json({
      status: 'ok',
      pipeline: 'regulatory-scan',
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Regulatory scan failed', error);
    return NextResponse.json(
      {
        status: 'error',
        pipeline: 'regulatory-scan',
        error: (error as Error).message,
      },
      { status: 500 },
    );
  }
}
