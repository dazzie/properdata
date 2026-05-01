/**
 * Generate a launch piece for Substack.
 *
 * Usage:
 *   export $(grep -v '^#' .env.local | grep '=' | xargs)
 *   NODE_OPTIONS='--conditions react-server' pnpm tsx scripts/generate-launch-piece.ts <piece>
 *
 * Pieces:
 *   1  "What Mullingar houses actually sold for" — 12-month PPR deep dive
 *   2  "The asking price illusion" — sold prices vs market perceptions
 *   3  "Ireland's hidden property hotspot" — undervalued town + grant stacking
 *
 * Output: writes markdown + SVG chart files to scripts/output/launch-piece-<N>/
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';
import { runAgent } from '../packages/agents/src/index';
import {
  priceTrendSpec,
  townComparisonSpec,
  propertyTypeMixSpec,
  renderChartToSvg,
} from '../packages/agents/src/charts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Export your .env.local first.');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

const piece = process.argv[2];
if (!piece || !['1', '2', '3'].includes(piece)) {
  console.error('Usage: pnpm tsx scripts/generate-launch-piece.ts <1|2|3>');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Data assembly
// ---------------------------------------------------------------------------

async function mullingarSalesData() {
  const rows = await sql(`
    SELECT
      TO_CHAR(sale_date, 'YYYY-MM') AS month,
      property_type,
      price::numeric AS price,
      COALESCE(address_normalised, address_raw) AS address,
      sale_date,
      is_new
    FROM sales
    WHERE county ILIKE 'Westmeath'
      AND (address_normalised ILIKE '%mullingar%' OR address_raw ILIKE '%mullingar%')
      AND sale_date >= CURRENT_DATE - INTERVAL '12 months'
    ORDER BY sale_date DESC
  `);
  return rows;
}

async function countyMedians() {
  const rows = await sql(`
    SELECT
      county,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price::numeric) AS median_price,
      COUNT(*)::integer AS sale_count
    FROM sales
    WHERE sale_date >= CURRENT_DATE - INTERVAL '12 months'
    GROUP BY county
    HAVING COUNT(*) >= 20
    ORDER BY median_price ASC
  `);
  return rows;
}

async function propertyTypeMix(townPattern: string) {
  const rows = await sql(
    `SELECT
      COALESCE(property_type, 'unknown') AS property_type,
      COUNT(*)::integer AS count
    FROM sales
    WHERE (address_normalised ILIKE $1 OR address_raw ILIKE $1)
      AND sale_date >= CURRENT_DATE - INTERVAL '12 months'
    GROUP BY property_type
    ORDER BY count DESC`,
    [`%${townPattern}%`],
  );
  return rows;
}

async function monthlyMedians(townPattern: string) {
  const rows = await sql(
    `SELECT
      TO_CHAR(sale_date, 'YYYY-MM-01') AS month,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price::numeric) AS median_price
    FROM sales
    WHERE (address_normalised ILIKE $1 OR address_raw ILIKE $1)
      AND sale_date >= CURRENT_DATE - INTERVAL '12 months'
    GROUP BY TO_CHAR(sale_date, 'YYYY-MM-01')
    ORDER BY month`,
    [`%${townPattern}%`],
  );
  return rows;
}

async function grantSchemes() {
  const rows = await sql(`
    SELECT code, name, max_amount::numeric AS max_amount, description
    FROM grant_schemes
    WHERE is_active = true
    ORDER BY category, name
  `);
  return rows;
}

// ---------------------------------------------------------------------------
// Prompt templates
// ---------------------------------------------------------------------------

const PIECE_PROMPTS: Record<string, { title: string; prompt: string }> = {
  '1': {
    title: 'What Mullingar houses actually sold for',
    prompt: `Write a 1,500–2,500 word long-form data analysis piece titled "What Mullingar houses actually sold for".

This is the debut piece for ProperData, an Irish property intelligence newsletter. The piece should:

1. Open with a compelling lede about the gap between perception and reality in property prices
2. Break down the last 12 months of PPR (Property Price Register) sales in Mullingar by:
   - Property type (detached, semi-detached, terraced, apartment)
   - Price ranges and median prices
   - New builds vs second-hand
3. Highlight notable sales — biggest, smallest, most unusual
4. Compare to the broader Westmeath/Midlands picture
5. Close with what this data means for buyers entering the market now

Voice: specific, data-grounded, conversational. No estate agent clichés. Numbers earn their place.

Privacy: never include house numbers. Use "a semi-detached on Grange Drive" style.

Include a one-line disclaimer: "This analysis reflects PPR data and is not financial advice."

Output as markdown.`,
  },
  '2': {
    title: 'The asking price illusion',
    prompt: `Write a 1,000–1,500 word analysis piece titled "The asking price illusion".

This piece makes the case that asking prices (from listing sites) are systematically misleading, and that PPR sold prices tell the real story. It should:

1. Open with the common experience: browsing Daft, seeing prices, forming expectations
2. Show with real PPR data how sold prices differ from what people expect
3. Use county-level median sold prices to ground the argument in data
4. Explain why ProperData uses PPR data exclusively — it's verified, government-published, and covers every residential sale in Ireland since 2010
5. Acknowledge the limitation: PPR doesn't include asking prices, so we can't directly show the gap, but we can show what actually sold for and let readers compare to their own Daft browsing experience
6. Close with the ProperData value proposition: real prices, real data, no illusions

Voice: confident, slightly provocative, data-first. This is the piece that makes people subscribe.

Output as markdown.`,
  },
  '3': {
    title: "Ireland's hidden property hotspot",
    prompt: `Write a 1,000–1,500 word analysis piece titled "Ireland's hidden property hotspot".

This piece identifies the most undervalued town in the dataset by combining:
- Low median property prices relative to the national average
- Available grant stacking potential (Croí Cónaithe + SEAI = €60K–70K+ for vacant properties)
- Decent sales volume (showing it's an active market, not a ghost town)

The piece should:

1. Open with the concept: everyone talks about Dublin and Galway, but the data points elsewhere
2. Present the data-driven case for the "hidden hotspot" town
3. Walk through a concrete example: a €200K property with €65K in stacked grants, showing the effective acquisition cost
4. Show how ProperData's cross-referencing of PPR + grants + local data reveals opportunities invisible on any listing site
5. Close with a call to action — subscribe for weekly intelligence on these opportunities

Voice: data-driven storytelling. Show, don't tell. Let the numbers make the case.

Include disclaimer: "Grant eligibility is determined by the relevant scheme administrator. This estimate reflects publicly available rules and should be confirmed before relying on it."

Output as markdown.`,
  },
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const pieceConfig = PIECE_PROMPTS[piece]!;
  const outDir = join(__dirname, 'output', `launch-piece-${piece}`);
  mkdirSync(outDir, { recursive: true });

  console.log(`Generating: "${pieceConfig.title}"\n`);

  // Assemble data
  console.log('Assembling data...');
  const [sales, medians, typeMix, monthly, grants] = await Promise.all([
    mullingarSalesData(),
    countyMedians(),
    propertyTypeMix('mullingar'),
    monthlyMedians('mullingar'),
    grantSchemes(),
  ]);

  console.log(
    `  ${sales.length} Mullingar sales, ${medians.length} counties, ${grants.length} grant schemes\n`,
  );

  // Build context for the agent
  const dataContext = JSON.stringify(
    {
      mullingar_sales_12m: sales.slice(0, 50),
      county_medians: medians,
      property_type_mix: typeMix,
      monthly_medians: monthly,
      grant_schemes: grants.slice(0, 20),
      total_mullingar_sales: sales.length,
    },
    null,
    2,
  );

  // Generate draft
  console.log('Generating draft (Sonnet)...');
  const markdown = await runAgent<string>({
    promptName: 'draft-writer',
    model: 'sonnet',
    input: `${pieceConfig.prompt}\n\nHere is the data to work with:\n\n${dataContext}`,
    maxTokens: 4096,
    expectJson: false,
  });

  writeFileSync(join(outDir, 'draft.md'), markdown, 'utf-8');
  const wordCount = markdown.split(/\s+/).filter((w) => w.length > 0).length;
  console.log(`  Draft: ${wordCount} words\n`);

  // Generate charts
  console.log('Rendering charts...');

  if (monthly.length >= 3) {
    const trendData = monthly.map((r) => ({
      month: r.month as string,
      median_price: Number(r.median_price),
    }));
    const svg = await renderChartToSvg(
      priceTrendSpec(trendData, 'Mullingar median price — last 12 months'),
    );
    writeFileSync(join(outDir, 'price-trend.svg'), svg, 'utf-8');
    console.log('  price-trend.svg');
  }

  if (medians.length >= 3) {
    const compData = medians.slice(0, 12).map((r) => ({
      town: r.county as string,
      median_price: Number(r.median_price),
    }));
    const svg = await renderChartToSvg(
      townComparisonSpec(compData, 'Median sale price by county (12 months)'),
    );
    writeFileSync(join(outDir, 'county-comparison.svg'), svg, 'utf-8');
    console.log('  county-comparison.svg');
  }

  if (typeMix.length >= 2) {
    const mixData = typeMix.map((r) => ({
      property_type: (r.property_type as string).replace('_', ' '),
      count: Number(r.count),
    }));
    const svg = await renderChartToSvg(
      propertyTypeMixSpec(mixData, 'Mullingar sales by property type'),
    );
    writeFileSync(join(outDir, 'property-type-mix.svg'), svg, 'utf-8');
    console.log('  property-type-mix.svg');
  }

  console.log(`\nDone! Output in: ${outDir}`);
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
