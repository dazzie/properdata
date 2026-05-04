import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey, deductCredit, logUsage } from '../../auth';
import { runPropertyAnalysis, type AnalyseRequest } from '../../../property/analyse/run-analysis';

export const maxDuration = 60;

class ValidationError extends Error {}

function validateApiInput(body: unknown): AnalyseRequest {
  const b = body as Record<string, unknown>;

  if (!b || typeof b !== 'object') {
    throw new ValidationError('Request body must be a JSON object');
  }
  if (!b.county || typeof b.county !== 'string') {
    throw new ValidationError('county is required');
  }
  if (typeof b.purchase_price !== 'number' || b.purchase_price <= 0) {
    throw new ValidationError('purchase_price must be a positive number');
  }

  const validBuyerTypes = ['first_time_buyer', 'former_owner_occupier', 'non_occupier'];
  if (!validBuyerTypes.includes(b.buyer_type as string)) {
    throw new ValidationError(`buyer_type must be one of: ${validBuyerTypes.join(', ')}`);
  }
  const validUses = ['owner_occupier', 'rental', 'mixed'];
  if (!validUses.includes(b.intended_use as string)) {
    throw new ValidationError(`intended_use must be one of: ${validUses.join(', ')}`);
  }

  return {
    address: b.address as string | undefined,
    county: b.county as string,
    eircodeRoutingKey: b.eircode ? (b.eircode as string).slice(0, 3) : undefined,
    purchasePrice: b.purchase_price as number,
    propertyType: b.property_type as AnalyseRequest['propertyType'],
    bedrooms: b.bedrooms as number | undefined,
    berRating: b.ber_rating as string | undefined,
    yearBuilt: b.year_built as number | undefined,
    location: b.lat != null && b.lng != null
      ? { lat: b.lat as number, lng: b.lng as number }
      : undefined,
    buyer: {
      buyerType: b.buyer_type as 'first_time_buyer' | 'former_owner_occupier' | 'non_occupier',
      intendedUse: b.intended_use as 'owner_occupier' | 'rental' | 'mixed',
    },
  };
}

export async function POST(request: NextRequest) {
  const start = Date.now();

  const auth = await authenticateApiKey(request);
  if ('error' in auth) return auth.error;

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  let req: AnalyseRequest;
  try {
    req = validateApiInput(body);
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
  }

  try {
    const credited = await deductCredit(auth.key.id);
    if (!credited) {
      return NextResponse.json(
        { error: 'No credits remaining. Purchase more at /dashboard' },
        { status: 403 },
      );
    }

    const result = await runPropertyAnalysis(req, start);

    await logUsage(auth.key.id, '/v1/property/report', body, 200, Date.now() - start, ip, 1);

    return NextResponse.json({
      data: result,
      credits_remaining: auth.key.credits_remaining - 1,
    });
  } catch (err) {
    console.error('API report failed:', err);
    await logUsage(auth.key.id, '/v1/property/report', body, 500, Date.now() - start, ip, 0);

    // Refund credit on failure
    const sql = (await import('../../../property/db')).getSQL();
    await sql('UPDATE api_keys SET credits_remaining = credits_remaining + 1 WHERE id = $1', [
      auth.key.id,
    ]).catch(() => {});

    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `Analysis failed: ${message}` }, { status: 500 });
  }
}
