import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { Redis } from '@upstash/redis';
import {
  findComparableCandidates,
  findActiveGrantSchemes,
  findRentBenchmark,
  type ComparableTarget,
} from '@properdata/db';
import {
  comparableAnalysis,
  grantCalculator,
  yieldAnalysis,
  DEFAULT_COST_ASSUMPTIONS,
  type ComparableAnalysisInput,
  type GrantCalculatorInput,
  type GrantSchemeInput,
  type YieldAnalysisInput,
  type ComparableAnalysisResult,
  type GrantCalculationResult,
  type YieldAnalysisResult,
} from '@properdata/agents';
import type { PropertyAttributes, BuyerContext } from '@properdata/shared';

interface AnalyseRequest {
  address?: string;
  location?: { lat: number; lng: number };
  county: string;
  eircodeRoutingKey?: string;
  propertyType?: PropertyAttributes['propertyType'];
  bedrooms?: number;
  purchasePrice: number;
  berRating?: string;
  yearBuilt?: number;
  isVacant?: boolean;
  vacantSinceYear?: number;
  isDerelict?: boolean;
  buyer: BuyerContext;
  costOverrides?: Partial<typeof DEFAULT_COST_ASSUMPTIONS>;
}

interface AnalyseResponse {
  comparable: ComparableAnalysisResult;
  grants: GrantCalculationResult;
  yield?: YieldAnalysisResult;
  metadata: {
    elapsedMs: number;
    agentCalls: number;
    estimatedCost: number;
    from_cache: boolean;
  };
}

const CACHE_TTL_SECONDS = 86400; // 24 hours

function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}

function buildCacheKey(req: AnalyseRequest): string {
  const seed = JSON.stringify({
    a: req.address,
    loc: req.location,
    c: req.county,
    pt: req.propertyType,
    b: req.bedrooms,
    pp: req.purchasePrice,
    bt: req.buyer.buyerType,
    iu: req.buyer.intendedUse,
  });
  const hash = createHash('sha256').update(seed).digest('hex').slice(0, 16);
  return `analyse:${hash}`;
}

class ValidationError extends Error {}

function validateRequest(body: unknown): AnalyseRequest {
  const b = body as Record<string, unknown>;

  if (!b || typeof b !== 'object') {
    throw new ValidationError('Request body must be a JSON object');
  }
  if (!b.county || typeof b.county !== 'string') {
    throw new ValidationError('county is required');
  }
  if (typeof b.purchasePrice !== 'number' || b.purchasePrice <= 0) {
    throw new ValidationError('purchasePrice must be a positive number');
  }
  if (!b.buyer || typeof b.buyer !== 'object') {
    throw new ValidationError('buyer context is required');
  }

  const buyer = b.buyer as Record<string, unknown>;
  const validBuyerTypes = ['first_time_buyer', 'former_owner_occupier', 'non_occupier'];
  if (!validBuyerTypes.includes(buyer.buyerType as string)) {
    throw new ValidationError(`buyer.buyerType must be one of: ${validBuyerTypes.join(', ')}`);
  }
  const validUses = ['owner_occupier', 'rental', 'mixed'];
  if (!validUses.includes(buyer.intendedUse as string)) {
    throw new ValidationError(`buyer.intendedUse must be one of: ${validUses.join(', ')}`);
  }

  return b as unknown as AnalyseRequest;
}

// Sonnet input cost ~$3/MTok, output ~$15/MTok. Each agent call ~2K in + ~2K out.
const ESTIMATED_COST_PER_AGENT_CALL = 0.036;

export async function POST(request: NextRequest) {
  const start = Date.now();

  let req: AnalyseRequest;
  try {
    const body = await request.json();
    req = validateRequest(body);
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const redis = getRedis();
  const cacheKey = buildCacheKey(req);

  if (redis) {
    try {
      const cached = await redis.get<AnalyseResponse>(cacheKey);
      if (cached) {
        return NextResponse.json({
          ...cached,
          metadata: { ...cached.metadata, elapsedMs: Date.now() - start, from_cache: true },
        });
      }
    } catch {
      // cache miss or redis unavailable — proceed with fresh analysis
    }
  }

  const property: PropertyAttributes = {
    address: req.address,
    county: req.county,
    location: req.location,
    propertyType: req.propertyType,
    bedrooms: req.bedrooms,
    purchasePrice: req.purchasePrice,
    berRating: req.berRating,
    yearBuilt: req.yearBuilt,
    isVacant: req.isVacant,
    vacantSinceYear: req.vacantSinceYear,
    isDerelict: req.isDerelict,
  };

  const comparableTarget: ComparableTarget = {
    county: req.county,
    location: req.location,
    eircodeRoutingKey: req.eircodeRoutingKey,
    propertyType: req.propertyType === 'unknown' ? undefined : req.propertyType,
  };

  try {
    const runYield = req.buyer.intendedUse === 'rental' || req.buyer.intendedUse === 'mixed';

    const [candidates, schemes, rentRow] = await Promise.all([
      findComparableCandidates(comparableTarget),
      findActiveGrantSchemes(),
      runYield ? findRentBenchmark({ county: req.county, bedrooms: req.bedrooms }) : null,
    ]);

    // Phase 2: run agents in parallel
    const comparableInput: ComparableAnalysisInput = {
      target: property,
      candidates: candidates.map((c) => ({
        address: c.addressNormalised ?? c.addressRaw,
        sale_date: c.saleDate,
        price: c.price,
        distance_meters: c.distanceMeters,
        property_type: c.propertyType,
        is_new: c.isNew,
        description: c.description,
        months_ago: c.monthsAgo,
      })),
    };

    const grantInput: GrantCalculatorInput = {
      property,
      buyer: req.buyer,
      available_schemes: schemes.map((s): GrantSchemeInput => ({
        code: s.code,
        name: s.name,
        provider: s.provider,
        category: s.category,
        max_amount: s.maxAmount,
        description: s.description,
        eligibility_rules: s.eligibilityRules,
      })),
    };

    let yieldInput: YieldAnalysisInput | null = null;
    if (runYield && rentRow?.standardisedMonthlyRent) {
      yieldInput = {
        property,
        rent_benchmark: {
          monthly_rent: rentRow.standardisedMonthlyRent,
          source: `RTB ${rentRow.quarter}, ${rentRow.county}${rentRow.bedrooms ? `, ${rentRow.bedrooms}-bed` : ''}${rentRow.propertyType ? `, ${rentRow.propertyType}` : ''}, new tenancies`,
          confidence: rentRow.sampleSize && rentRow.sampleSize >= 30 ? 'high' : 'medium',
        },
        cost_assumptions: { ...DEFAULT_COST_ASSUMPTIONS, ...req.costOverrides },
        buyer: req.buyer,
      };
    }

    const agentPromises: [
      Promise<ComparableAnalysisResult>,
      Promise<GrantCalculationResult>,
      Promise<YieldAnalysisResult> | Promise<null>,
    ] = [
      comparableAnalysis(comparableInput),
      grantCalculator(grantInput),
      yieldInput ? yieldAnalysis(yieldInput) : Promise.resolve(null),
    ];

    const [comparableResult, grantResult, yieldResult] = await Promise.all(agentPromises);

    const agentCalls = yieldResult ? 3 : 2;

    const response: AnalyseResponse = {
      comparable: comparableResult,
      grants: grantResult,
      ...(yieldResult ? { yield: yieldResult } : {}),
      metadata: {
        elapsedMs: Date.now() - start,
        agentCalls,
        estimatedCost: agentCalls * ESTIMATED_COST_PER_AGENT_CALL,
        from_cache: false,
      },
    };

    if (redis) {
      redis.set(cacheKey, response, { ex: CACHE_TTL_SECONDS }).catch(() => {});
    }

    return NextResponse.json(response);
  } catch (err) {
    console.error('Property analysis failed:', err);
    return NextResponse.json(
      { error: 'Analysis failed. Please try again.' },
      { status: 500 },
    );
  }
}
