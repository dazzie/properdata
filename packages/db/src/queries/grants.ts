import 'server-only';

import { neon } from '@neondatabase/serverless';

export interface ActiveGrantScheme {
  code: string;
  name: string;
  provider: string;
  category: string;
  maxAmount: number | null;
  description: string;
  eligibilityRules: {
    buyerType?: string[];
    propertyType?: string[];
    vacancyMinYears?: number;
    maxBerRating?: string;
    minBuildYear?: number;
    maxBuildYear?: number;
    maxPropertyValue?: number;
    stackingExclusions?: string[];
  };
}

function getSql() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }
  return neon(process.env.DATABASE_URL);
}

export async function findActiveGrantSchemes(): Promise<ActiveGrantScheme[]> {
  const sql = getSql();

  const rows = await sql(`
    SELECT
      code,
      name,
      provider,
      category,
      max_amount::numeric AS "maxAmount",
      description,
      eligibility_rules AS "eligibilityRules"
    FROM grant_schemes
    WHERE is_active = true
      AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
    ORDER BY category, name
  `);

  return rows as unknown as ActiveGrantScheme[];
}
