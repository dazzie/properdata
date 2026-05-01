/**
 * Anomaly detection cron job.
 *
 * Schedule: Monday at 06:00 UTC (see vercel.json)
 *
 * For each active town, fetches current and baseline (YoY) metrics,
 * runs the Anomaly Detector Agent (Haiku), and stores high-significance
 * anomalies as events.
 */

import { NextResponse } from 'next/server';
import {
  db,
  events,
  getAnomalyMetrics,
  getActiveTownIds,
} from '@properdata/db';
import { detectAnomalies } from '@properdata/agents';
import { notifySlack } from '@properdata/shared';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization');
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const townIds = await getActiveTownIds();

    if (townIds.length === 0) {
      return NextResponse.json({
        status: 'ok',
        pipeline: 'anomaly-detect',
        message: 'No active towns',
        timestamp: new Date().toISOString(),
      });
    }

    let totalAnomalies = 0;
    let highAnomalies = 0;
    const highAlerts: string[] = [];

    for (const townId of townIds) {
      const { current, baseline } = await getAnomalyMetrics(townId);

      if (!current || !baseline) continue;

      const result = await detectAnomalies({
        town: current.townName,
        current_metrics: {
          median_price_90d: current.medianPrice90d,
          median_price_12m: current.medianPrice12m,
          sales_count_90d: current.salesCount90d,
          yoy_price_change: current.yoyPriceChange,
          new_build_share: current.newBuildShare,
          ftb_share: current.ftbShare,
        },
        baseline_metrics: {
          median_price_90d: baseline.medianPrice90d,
          median_price_12m: baseline.medianPrice12m,
          sales_count_90d: baseline.salesCount90d,
          yoy_price_change: baseline.yoyPriceChange,
          new_build_share: baseline.newBuildShare,
          ftb_share: baseline.ftbShare,
        },
      });

      totalAnomalies += result.anomalies.length;

      for (const anomaly of result.anomalies) {
        if (anomaly.significance === 'high') {
          highAnomalies++;
          highAlerts.push(`${current.townName}: ${anomaly.metric} — ${anomaly.explanation}`);

          await db.insert(events).values({
            eventType: 'anomaly_detected',
            source: `anomaly-detect:${current.townName}`,
            payload: {
              town_id: townId,
              town_name: current.townName,
              ...anomaly,
            },
          });
        }
      }
    }

    if (highAlerts.length > 0) {
      await notifySlack(
        `🔍 Anomaly detection: ${highAnomalies} high-significance anomalies found\n\n${highAlerts.join('\n')}`,
      );
    }

    return NextResponse.json({
      status: 'ok',
      pipeline: 'anomaly-detect',
      result: {
        towns_checked: townIds.length,
        total_anomalies: totalAnomalies,
        high_anomalies: highAnomalies,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Anomaly detection failed', error);
    return NextResponse.json(
      {
        status: 'error',
        pipeline: 'anomaly-detect',
        error: (error as Error).message,
      },
      { status: 500 },
    );
  }
}
