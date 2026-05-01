import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getSQL } from '../db';

const SYSTEM_PROMPT = `You are a SQL query generator for an Irish property sales database. The database contains the Property Price Register — all residential property sales in Ireland since 2010.

The main table is \`sales\` with these columns:
- id (bigint, PK)
- sale_date (date) — when the sale was registered
- price (numeric) — sale price in euros
- address_raw (text) — original PPR address
- address_normalised (text) — cleaned address (may be null)
- county (varchar) — e.g. "Dublin", "Cork", "Galway"
- eircode (varchar) — e.g. "D08T2H6" (may be null)
- property_type (enum: detached, semi_detached, terraced, apartment, duplex, bungalow, unknown — may be null)
- is_new (boolean) — true for new builds, false for second-hand
- description (text) — e.g. "Second-Hand Dwelling house /Apartment"

Rules:
1. ONLY generate SELECT queries. Never INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE.
2. Always add LIMIT (max 100) unless the user explicitly asks for aggregates/counts.
3. For aggregate queries (averages, counts, medians), no LIMIT is needed on the outer query.
4. Use ILIKE for text matching (case-insensitive).
5. County names are title case: "Dublin", "Cork", "Galway", "Limerick", "Waterford", "Kilkenny", etc.
6. For median, use: percentile_cont(0.5) WITHIN GROUP (ORDER BY price::numeric)
7. Price is stored as numeric — cast to numeric for aggregates: price::numeric
8. Return useful columns — include address, price, date, county, property_type for sales queries.
9. Order sales by sale_date DESC by default.
10. Do not invent or create facts that are not in the data. Only return information derived from actual database records. If the data cannot answer the question, say so in the description.

Respond with ONLY a JSON object, no markdown, no explanation:
{
  "sql": "SELECT ...",
  "title": "Short title for the results",
  "description": "One-line description of what this query returns"
}`;

function loadEnvFallback() {
  if (process.env.ANTHROPIC_API_KEY) return;
  try {
    const { readFileSync } = require('node:fs');
    const { resolve } = require('node:path');
    const envPath = resolve(process.cwd(), '../../.env.local');
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      if (line.startsWith('#') || !line.includes('=')) continue;
      const eqIdx = line.indexOf('=');
      const key = line.slice(0, eqIdx).trim();
      const val = line.slice(eqIdx + 1).trim();
      if (key && !process.env[key]) {
        process.env[key] = val;
      }
    }
  } catch {
    // fallback not found
  }
}

export async function POST(request: NextRequest) {
  loadEnvFallback();

  const { question } = await request.json();
  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    return NextResponse.json({ error: 'Question is required' }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not set' }, { status: 500 });
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const sql = getSQL();

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: question.trim() }],
    });

    const text =
      message.content[0]?.type === 'text' ? message.content[0].text : '';

    let parsed: { sql: string; title: string; description: string };
    try {
      const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        { error: 'Failed to parse AI response', raw: text },
        { status: 500 },
      );
    }

    const query = parsed.sql.trim().replace(/;$/, '');
    const upper = query.toUpperCase();
    if (
      upper.startsWith('INSERT') ||
      upper.startsWith('UPDATE') ||
      upper.startsWith('DELETE') ||
      upper.startsWith('DROP') ||
      upper.startsWith('ALTER') ||
      upper.startsWith('TRUNCATE') ||
      upper.startsWith('CREATE')
    ) {
      return NextResponse.json(
        { error: 'Only SELECT queries are allowed' },
        { status: 400 },
      );
    }

    const rows = await sql(query);

    return NextResponse.json({
      rows,
      title: parsed.title,
      description: parsed.description,
      sql: parsed.sql,
      total: rows.length,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
