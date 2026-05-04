import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { authenticateMasterKey } from '../../v1/auth';

const CREDIT_PACKS: Record<string, { credits: number; amount: number; name: string }> = {
  '10': { credits: 10, amount: 4900, name: '10 Property Report Credits' },
  '50': { credits: 50, amount: 19900, name: '50 Property Report Credits' },
  '200': { credits: 200, amount: 64900, name: '200 Property Report Credits' },
};

export async function POST(request: NextRequest) {
  const authResult = authenticateMasterKey(request);
  if ('error' in authResult) return authResult.error;

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
  }

  const body = await request.json() as Record<string, unknown>;
  const apiKeyId = body.api_key_id as number | undefined;
  const packKey = String(body.pack ?? '');

  if (!apiKeyId) {
    return NextResponse.json({ error: 'api_key_id is required' }, { status: 400 });
  }

  const pack = CREDIT_PACKS[packKey];
  if (!pack) {
    return NextResponse.json(
      { error: `pack must be one of: ${Object.keys(CREDIT_PACKS).join(', ')}` },
      { status: 400 },
    );
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const origin = request.headers.get('origin') ?? 'https://properdata.ie';

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: 'eur',
          unit_amount: pack.amount,
          product_data: { name: pack.name },
        },
        quantity: 1,
      },
    ],
    metadata: {
      api_key_id: String(apiKeyId),
      credits: String(pack.credits),
    },
    success_url: `${origin}/dashboard?checkout=success`,
    cancel_url: `${origin}/dashboard?checkout=cancelled`,
  });

  return NextResponse.json({ checkout_url: session.url });
}
