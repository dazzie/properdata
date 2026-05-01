/**
 * Regulatory monitor — daily page hash diffing.
 *
 * Checks key government pages for content changes and, when a change is
 * detected, calls the Regulatory Monitor Agent to determine if it's material.
 *
 * Monitored pages: SEAI grants, Croí Cónaithe, Revenue HTB, RTB, etc.
 */

import { createHash } from 'node:crypto';

export interface MonitoredPage {
  url: string;
  label: string;
  category: string;
}

export interface RegulatoryCheckResult {
  checked: number;
  changed: number;
  material: number;
}

// ---------------------------------------------------------------------------
// Monitored URLs
// ---------------------------------------------------------------------------

export const MONITORED_PAGES: MonitoredPage[] = [
  {
    url: 'https://www.gov.ie/en/service/7e3e3-vacant-property-refurbishment-grant/',
    label: 'Croí Cónaithe Vacant Property Grant',
    category: 'grants',
  },
  {
    url: 'https://www.seai.ie/grants/home-energy-grants/',
    label: 'SEAI Home Energy Grants',
    category: 'grants',
  },
  {
    url: 'https://www.revenue.ie/en/property/help-to-buy-incentive/index.aspx',
    label: 'Revenue Help to Buy',
    category: 'tax',
  },
  {
    url: 'https://www.rtb.ie/registration-and-compliance/rent-pressure-zones',
    label: 'RTB Rent Pressure Zones',
    category: 'rental',
  },
  {
    url: 'https://www.gov.ie/en/publication/d4e69-first-home-scheme/',
    label: 'First Home Scheme',
    category: 'grants',
  },
  {
    url: 'https://www.revenue.ie/en/property/stamp-duty/index.aspx',
    label: 'Stamp Duty Rates',
    category: 'tax',
  },
];

// ---------------------------------------------------------------------------
// Content extraction — strip nav/footer/boilerplate
// ---------------------------------------------------------------------------

function extractMainContent(html: string): string {
  // Remove script and style blocks
  let content = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '');

  // Try to extract main/article content
  const mainMatch = content.match(/<main[\s\S]*?<\/main>/i) ??
    content.match(/<article[\s\S]*?<\/article>/i) ??
    content.match(/<div[^>]*(?:id|class)="[^"]*(?:content|main|article)[^"]*"[\s\S]*?<\/div>/i);

  if (mainMatch) {
    content = mainMatch[0];
  }

  // Strip all HTML tags, normalize whitespace
  content = content
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#\d+;/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return content;
}

function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

// ---------------------------------------------------------------------------
// Check pages for changes
// ---------------------------------------------------------------------------

export async function checkRegulatoryPages(): Promise<RegulatoryCheckResult> {
  const dbMod = await import('@properdata/db');
  const drizzle = await import('drizzle-orm');

  const { db, events } = dbMod;
  const { eq, and, desc } = drizzle;

  let checked = 0;
  let changed = 0;
  let material = 0;

  for (const page of MONITORED_PAGES) {
    checked++;

    try {
      // Fetch the page
      const response = await fetch(page.url, {
        headers: {
          'User-Agent': 'ProperData/1.0 (regulatory monitoring)',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        console.warn(`Failed to fetch ${page.label}: ${response.status}`);
        continue;
      }

      const html = await response.text();
      const content = extractMainContent(html);
      const currentHash = hashContent(content);

      // Check for the most recent hash for this URL
      const previousEvents = await db
        .select({ payload: events.payload })
        .from(events)
        .where(
          and(
            eq(events.eventType, 'regulatory_page_hash'),
            eq(events.source, page.url),
          ),
        )
        .orderBy(desc(events.occurredAt))
        .limit(1);

      const previousHash = previousEvents[0]
        ? (previousEvents[0].payload as { hash?: string }).hash ?? null
        : null;

      // Always store the current hash
      await db.insert(events).values({
        eventType: 'regulatory_page_hash',
        source: page.url,
        payload: {
          hash: currentHash,
          label: page.label,
          category: page.category,
          content_length: content.length,
        },
      });

      // If no previous hash or same hash, skip agent call
      if (!previousHash || previousHash === currentHash) {
        continue;
      }

      // Content changed — call the Regulatory Monitor Agent
      changed++;
      console.log(`Change detected: ${page.label}`);

      try {
        // Fetch old content from previous event for the agent
        // (We only store the hash, not the full content, to save space.
        //  Pass a truncated diff-like comparison instead.)
        const agentsMod = await import('@properdata/agents');
        const result = await agentsMod.checkRegulatoryChange({
          url: page.url,
          label: page.label,
          category: page.category,
          new_content: content.slice(0, 5000),
        });

        if (result.is_material) {
          material++;
          console.log(`Material change: ${page.label} — ${result.summary}`);

          await db.insert(events).values({
            eventType: 'regulatory_change',
            source: page.url,
            payload: {
              label: page.label,
              ...result,
              category: page.category,
            },
          });
        }
      } catch (agentErr) {
        console.error(`Agent call failed for ${page.label}:`, (agentErr as Error).message.slice(0, 150));
      }
    } catch (err) {
      console.error(`Check failed for ${page.label}:`, (err as Error).message.slice(0, 150));
    }
  }

  console.log(`Regulatory scan: ${checked} checked, ${changed} changed, ${material} material`);

  return { checked, changed, material };
}
