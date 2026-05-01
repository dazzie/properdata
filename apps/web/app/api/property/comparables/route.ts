import { NextRequest, NextResponse } from 'next/server';
import { findComparableCandidates, type ComparableTarget } from '@properdata/db';

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const county = params.get('county');
  if (!county) {
    return NextResponse.json({ error: 'county is required' }, { status: 400 });
  }

  const target: ComparableTarget = { county };

  const lat = params.get('lat');
  const lng = params.get('lng');
  if (lat && lng) {
    target.location = { lat: Number(lat), lng: Number(lng) };
  }

  const eircode = params.get('eircode_routing_key');
  if (eircode) {
    target.eircodeRoutingKey = eircode;
  }

  const propertyType = params.get('property_type');
  if (propertyType) {
    target.propertyType = propertyType as ComparableTarget['propertyType'];
  }

  const maxRadius = params.get('max_radius');
  if (maxRadius) target.maxRadiusMeters = Number(maxRadius);

  const maxAge = params.get('max_age_months');
  if (maxAge) target.maxAgeMonths = Number(maxAge);

  const limit = params.get('limit');
  if (limit) target.limit = Number(limit);

  try {
    const candidates = await findComparableCandidates(target);
    return NextResponse.json({ candidates, count: candidates.length });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
