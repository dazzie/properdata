#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { neon } from '@neondatabase/serverless';

// Load .env.local if DATABASE_URL not already in env
if (!process.env.DATABASE_URL) {
  try {
    const envPath = resolve(process.cwd(), '.env.local');
    const envContent = readFileSync(envPath, 'utf-8');
    for (const line of envContent.split('\n')) {
      if (line.startsWith('#') || !line.includes('=')) continue;
      const eqIdx = line.indexOf('=');
      const key = line.slice(0, eqIdx).trim();
      const val = line.slice(eqIdx + 1).trim();
      if (key && !process.env[key]) {
        process.env[key] = val;
      }
    }
  } catch {
    // .env.local not found, rely on environment
  }
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  process.stderr.write('DATABASE_URL is not set\n');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

const server = new McpServer({
  name: 'properdata',
  version: '0.1.0',
});

// ---------------------------------------------------------------------------
// Tool: run_sql — ad-hoc read-only queries
// ---------------------------------------------------------------------------

server.tool(
  'run_sql',
  'Run a read-only SQL query against the ProperData database. The database contains Irish property data: sales (PPR), towns, BER ratings, planning apps, grant schemes, RTB rents, CSO stats. Always use LIMIT to avoid huge result sets.',
  {
    query: z.string().describe('SQL SELECT query to execute. Must be read-only (no INSERT/UPDATE/DELETE).'),
  },
  async ({ query }) => {
    const trimmed = query.trim().replace(/;$/, '');
    const upper = trimmed.toUpperCase();

    if (
      upper.startsWith('INSERT') ||
      upper.startsWith('UPDATE') ||
      upper.startsWith('DELETE') ||
      upper.startsWith('DROP') ||
      upper.startsWith('ALTER') ||
      upper.startsWith('TRUNCATE') ||
      upper.startsWith('CREATE')
    ) {
      return { content: [{ type: 'text', text: 'Error: Only SELECT queries are allowed.' }] };
    }

    try {
      const rows = await sql(trimmed);
      const text =
        rows.length === 0
          ? 'No rows returned.'
          : JSON.stringify(rows, null, 2);
      return { content: [{ type: 'text', text }] };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `SQL Error: ${(err as Error).message}` }],
        isError: true,
      };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool: describe_tables — show schema info
// ---------------------------------------------------------------------------

server.tool(
  'describe_tables',
  'List all tables in the database with their columns and types.',
  {},
  async () => {
    const rows = await sql(`
      SELECT table_name, column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position
    `);
    return { content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }] };
  },
);

// ---------------------------------------------------------------------------
// Tool: search_sales — structured property search
// ---------------------------------------------------------------------------

server.tool(
  'search_sales',
  'Search property sales with filters. Returns up to `limit` rows sorted by sale date descending.',
  {
    county: z.string().optional().describe('County name (e.g. "Dublin", "Cork")'),
    min_price: z.number().optional().describe('Minimum sale price in euros'),
    max_price: z.number().optional().describe('Maximum sale price in euros'),
    from_date: z.string().optional().describe('Start date (YYYY-MM-DD)'),
    to_date: z.string().optional().describe('End date (YYYY-MM-DD)'),
    property_type: z
      .enum(['detached', 'semi_detached', 'terraced', 'apartment', 'duplex', 'bungalow'])
      .optional()
      .describe('Property type filter'),
    address_search: z.string().optional().describe('Text search in normalised address (case-insensitive ILIKE)'),
    is_new: z.boolean().optional().describe('Filter to new builds only'),
    limit: z.number().optional().default(20).describe('Max rows to return (default 20, max 100)'),
  },
  async (params) => {
    const conditions: string[] = [];
    const args: unknown[] = [];
    let idx = 1;

    if (params.county) {
      conditions.push(`county ILIKE $${idx}`);
      args.push(params.county);
      idx++;
    }
    if (params.min_price != null) {
      conditions.push(`price >= $${idx}`);
      args.push(params.min_price);
      idx++;
    }
    if (params.max_price != null) {
      conditions.push(`price <= $${idx}`);
      args.push(params.max_price);
      idx++;
    }
    if (params.from_date) {
      conditions.push(`sale_date >= $${idx}`);
      args.push(params.from_date);
      idx++;
    }
    if (params.to_date) {
      conditions.push(`sale_date <= $${idx}`);
      args.push(params.to_date);
      idx++;
    }
    if (params.property_type) {
      conditions.push(`property_type = $${idx}`);
      args.push(params.property_type);
      idx++;
    }
    if (params.address_search) {
      conditions.push(`address_normalised ILIKE $${idx}`);
      args.push(`%${params.address_search}%`);
      idx++;
    }
    if (params.is_new != null) {
      conditions.push(`is_new = $${idx}`);
      args.push(params.is_new);
      idx++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = Math.min(params.limit ?? 20, 100);

    const query = `
      SELECT id, sale_date, price, address_normalised, county, eircode,
             property_type, is_new, description
      FROM sales
      ${where}
      ORDER BY sale_date DESC
      LIMIT ${limit}
    `;

    try {
      const rows = await sql(query, args);
      return {
        content: [
          {
            type: 'text',
            text: rows.length === 0 ? 'No matching sales found.' : JSON.stringify(rows, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error: ${(err as Error).message}` }],
        isError: true,
      };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool: county_stats — aggregate stats per county
// ---------------------------------------------------------------------------

server.tool(
  'county_stats',
  'Get aggregate price statistics for a county, optionally filtered by year.',
  {
    county: z.string().optional().describe('County name. Omit for all counties.'),
    year: z.number().optional().describe('Filter to a specific year (e.g. 2024)'),
  },
  async (params) => {
    const conditions: string[] = [];
    const args: unknown[] = [];
    let idx = 1;

    if (params.county) {
      conditions.push(`county ILIKE $${idx}`);
      args.push(params.county);
      idx++;
    }
    if (params.year) {
      conditions.push(`extract(year from sale_date) = $${idx}`);
      args.push(params.year);
      idx++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT county,
             count(*) as total_sales,
             round(avg(price::numeric)) as avg_price,
             round(percentile_cont(0.5) WITHIN GROUP (ORDER BY price::numeric)) as median_price,
             round(min(price::numeric)) as min_price,
             round(max(price::numeric)) as max_price,
             round(100.0 * count(*) FILTER (WHERE is_new) / NULLIF(count(*), 0), 1) as new_build_pct,
             count(DISTINCT property_type) FILTER (WHERE property_type IS NOT NULL) as property_type_count
      FROM sales
      ${where}
      GROUP BY county
      ORDER BY total_sales DESC
    `;

    try {
      const rows = await sql(query, args);
      return { content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }] };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error: ${(err as Error).message}` }],
        isError: true,
      };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool: price_trends — time series of price stats
// ---------------------------------------------------------------------------

server.tool(
  'price_trends',
  'Get median/average price trends over time, grouped by year or quarter.',
  {
    county: z.string().optional().describe('County name. Omit for national.'),
    group_by: z.enum(['year', 'quarter']).default('year').describe('Time grouping'),
    property_type: z
      .enum(['detached', 'semi_detached', 'terraced', 'apartment', 'duplex', 'bungalow'])
      .optional()
      .describe('Filter by property type'),
  },
  async (params) => {
    const conditions: string[] = [];
    const args: unknown[] = [];
    let idx = 1;

    if (params.county) {
      conditions.push(`county ILIKE $${idx}`);
      args.push(params.county);
      idx++;
    }
    if (params.property_type) {
      conditions.push(`property_type = $${idx}`);
      args.push(params.property_type);
      idx++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const periodExpr =
      params.group_by === 'quarter'
        ? `extract(year from sale_date) || '-Q' || extract(quarter from sale_date)`
        : `extract(year from sale_date)`;

    const query = `
      SELECT ${periodExpr} as period,
             count(*) as total_sales,
             round(avg(price::numeric)) as avg_price,
             round(percentile_cont(0.5) WITHIN GROUP (ORDER BY price::numeric)) as median_price
      FROM sales
      ${where}
      GROUP BY period
      ORDER BY period
    `;

    try {
      const rows = await sql(query, args);
      return { content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }] };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error: ${(err as Error).message}` }],
        isError: true,
      };
    }
  },
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const transport = new StdioServerTransport();
await server.connect(transport);
