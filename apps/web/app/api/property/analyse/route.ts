import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { Redis } from '@upstash/redis';
import { runPropertyAnalysis, type AnalyseRequest, type AnalyseResponse } from './run-analysis';

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

  try {
    const response = await runPropertyAnalysis(req, start);

    if (redis) {
      redis.set(cacheKey, response, { ex: CACHE_TTL_SECONDS }).catch(() => {});
    }

    return NextResponse.json(response);
  } catch (err) {
    console.error('Property analysis failed:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { error: `Analysis failed: ${message}` },
      { status: 500 },
    );
  }
}
