import { NextResponse } from 'next/server';
import { db, sql, assembleWeeklyPulseData } from '@properdata/db';
import { draftWeeklyPulse } from '@properdata/agents';
import { notifyDraftReady } from '@properdata/shared';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization');
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const start = Date.now();

  try {
    const pulseData = await assembleWeeklyPulseData();

    const totalSales = pulseData.towns.reduce(
      (sum, t) => sum + t.notable_sales.length,
      0,
    );

    if (pulseData.towns.length === 0) {
      return NextResponse.json({
        status: 'skipped',
        reason: 'No active towns found',
        timestamp: new Date().toISOString(),
      });
    }

    const result = await draftWeeklyPulse(pulseData);

    await db.execute(
      sql`INSERT INTO events (event_type, source, payload)
          VALUES (
            'weekly_pulse_draft',
            'cron/weekly-pulse',
            ${JSON.stringify({
              week_ending: pulseData.week_ending,
              subject: result.suggested_subject,
              word_count: result.word_count,
              sections: result.sections,
              towns: pulseData.towns.map((t) => t.name),
              total_sales: totalSales,
              markdown: result.markdown,
            })}::jsonb
          )`,
    );

    await notifyDraftReady({
      subject: result.suggested_subject,
      wordCount: result.word_count,
      weekEnding: pulseData.week_ending,
      sections: result.sections,
    });

    return NextResponse.json({
      status: 'ok',
      pipeline: 'weekly-pulse',
      week_ending: pulseData.week_ending,
      subject: result.suggested_subject,
      word_count: result.word_count,
      sections: result.sections,
      towns_covered: pulseData.towns.map((t) => t.name),
      total_sales: totalSales,
      elapsed_ms: Date.now() - start,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Weekly pulse generation failed', error);
    return NextResponse.json(
      { status: 'error', error: (error as Error).message },
      { status: 500 },
    );
  }
}
