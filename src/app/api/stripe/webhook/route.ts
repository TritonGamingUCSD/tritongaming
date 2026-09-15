import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { stripe, stripeEnabled } from '@/lib/stripe';
import { createServiceClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!stripeEnabled || !stripe) {
    return NextResponse.json({ error: 'Stripe is not configured' }, { status: 503 });
  }

  const body = await request.text();
  const signature = request.headers.get('stripe-signature');
  if (!signature) return NextResponse.json({ error: 'Missing signature' }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const eventId = session.metadata?.event_id;
    const userId = session.metadata?.user_id;

    if (eventId && userId) {
      const supabase = createServiceClient();
      const { error } = await supabase
        .from('tickets')
        .insert({ event_id: eventId, user_id: userId, stripe_session_id: session.id });

      // 23505 = unique violation — duplicate webhook delivery, or the user already
      // has a ticket for this event. Either way, not a failure worth retrying over.
      if (error && error.code !== '23505') {
        return NextResponse.json({ error: 'Failed to create ticket' }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ received: true });
}
