import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stripe, stripeEnabled } from '@/lib/stripe';
import { isVerifiedMember } from '@/lib/capabilities';
import { hasBasicProfileInfo } from '@/lib/profile';
import { isCheckinWindowOpen } from '@/lib/checkinWindow';

export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { event_id, source: rawSource } = await request.json();
  // Where they came from (see lib/attribution) — free text from the browser, so tidy it before storing.
  const source = typeof rawSource === 'string' ? rawSource.replace(/[\u0000-\u001f]/g, '').trim().slice(0, 60) || null : null;
  if (!event_id) return NextResponse.json({ error: 'Missing event_id' }, { status: 400 });

  // Verified membership (any role held, including the auto-granted 'ucsd'
  // badge) gates UCSD-only events, free pricing, and how much profile info
  // is required — checked against actual role grants, not a live email
  // re-check. See isVerifiedMember for why.
  const [{ data: profile }, { data: roles }, { data: priv }] = await Promise.all([
    supabase.from('profiles').select('display_name, major, year, college, pronouns').eq('id', user.id).single(),
    supabase.from('user_roles').select('role, division_id').eq('user_id', user.id),
    supabase.from('profile_private').select('gender').eq('user_id', user.id).maybeSingle(),
  ]);
  const isUcsd = isVerifiedMember(roles ?? []);

  // Require basic profile info before anyone can claim a ticket — checked
  // against their account, so once it's filled in they never see this again.
  // Non-UCSD guests need a name, gender and pronouns; year/college/major are UCSD-only.
  if (!profile || !hasBasicProfileInfo({ ...profile, gender: priv?.gender ?? null }, isUcsd)) {
    return NextResponse.json(
      { error: 'Please complete your profile before getting a ticket.', needsProfile: true },
      { status: 400 }
    );
  }

  // Any published event can be ticketed — verify it exists and is published
  const { data: event } = await supabase
    .from('events')
    .select('id, title, max_capacity, ticket_price, audience, start_date, end_date')
    .eq('id', event_id)
    .eq('is_published', true)
    .single();

  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  // Same window as check-in: tickets can be claimed until the event ends,
  // and not after (a ticket to a finished event could never be used).
  if (!isCheckinWindowOpen(event)) {
    return NextResponse.json({ error: 'This event has already ended.' }, { status: 409 });
  }

  if (event.audience === 'ucsd_only' && !isUcsd) {
    return NextResponse.json({ error: 'This event is open to UCSD-affiliated members only.' }, { status: 403 });
  }

  // Already registered?
  const { data: existing } = await supabase
    .from('tickets')
    .select('id')
    .eq('event_id', event_id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: 'Already registered for this event' }, { status: 409 });
  }

  // Check capacity
  if (event.max_capacity) {
    const { count } = await supabase
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', event_id)
      .in('status', ['active', 'used']);

    if ((count ?? 0) >= event.max_capacity) {
      return NextResponse.json({ error: 'Event is at full capacity' }, { status: 409 });
    }
  }

  const price = isUcsd ? 0 : (event.ticket_price ?? 0);

  // Free ticket (UCSD-affiliated, or a public event with no charge) — issue immediately.
  if (price <= 0) {
    const { data: ticket, error } = await supabase
      .from('tickets')
      .insert({ event_id, user_id: user.id, source })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Already registered for this event' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Failed to create ticket' }, { status: 500 });
    }

    // Best-effort — a notification that fails to write shouldn't fail the
    // ticket purchase that already succeeded.
    await supabase.from('notifications').insert({
      user_id: user.id,
      type: 'ticket_confirmed',
      title: 'Ticket confirmed',
      body: `You're registered for ${event.title}.`,
      href: '/portal?section=tickets',
    });

    return NextResponse.json({ free: true, ticket }, { status: 201 });
  }

  // Paid ticket (non-UCSD attendee on a priced public event) — send them to Stripe.
  // The ticket row itself is only created once the webhook confirms payment.
  if (!stripeEnabled || !stripe) {
    return NextResponse.json(
      { error: 'Ticket purchases for this event aren’t available yet. Please check back soon.' },
      { status: 503 }
    );
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: Math.round(price * 100),
        product_data: { name: event.title },
      },
    }],
    metadata: { event_id, user_id: user.id, ...(source ? { source } : {}) },
    success_url: `${origin}/portal/tickets?checkout=success`,
    cancel_url: `${origin}/portal/tickets?checkout=cancelled`,
  });

  return NextResponse.json({ url: session.url });
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: tickets } = await supabase
    .from('tickets')
    .select(`
      id, status, checked_in_at, created_at,
      event:events(id, title, start_date, end_date, location, flyer_url)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  return NextResponse.json({ tickets });
}
