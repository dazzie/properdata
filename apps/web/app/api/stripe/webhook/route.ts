import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getSQL } from '../../property/db';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const rawBody = await request.text();
  const sig = request.headers.get('stripe-signature');

  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Stripe webhook verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const apiKeyId = session.metadata?.api_key_id;
    const credits = Number(session.metadata?.credits ?? 0);

    if (apiKeyId && credits > 0) {
      const sql = getSQL();
      await sql(
        `UPDATE api_keys
         SET credits_remaining = credits_remaining + $1,
             credits_purchased = credits_purchased + $1
         WHERE id = $2`,
        [credits, apiKeyId],
      );

      await sql(
        `INSERT INTO events (event_type, source, payload)
         VALUES ('credits_purchased', 'stripe', $1)`,
        [JSON.stringify({
          api_key_id: apiKeyId,
          credits,
          stripe_session_id: session.id,
          amount_total: session.amount_total,
        })],
      );
    }
  }

  return NextResponse.json({ received: true });
}
