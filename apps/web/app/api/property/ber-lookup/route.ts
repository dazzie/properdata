import { NextRequest, NextResponse } from 'next/server';
import { lookupBerByRoutingKey } from '@properdata/db';

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const eircode = params.get('eircode');
  const routingKey = params.get('routing_key') ?? eircode?.slice(0, 3);
  const county = params.get('county') ?? undefined;
  const propertyType = params.get('property_type') ?? undefined;

  if (!routingKey && !county) {
    return NextResponse.json({ error: 'eircode, routing_key, or county required' }, { status: 400 });
  }

  try {
    const result = await lookupBerByRoutingKey({
      routingKey: routingKey && routingKey.length >= 3 ? routingKey.slice(0, 3) : undefined,
      county,
      propertyType,
    });

    if (!result) {
      return NextResponse.json({ found: false });
    }

    return NextResponse.json({ found: true, ...result });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
