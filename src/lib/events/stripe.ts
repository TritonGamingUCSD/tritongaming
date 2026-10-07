import Stripe from 'stripe';

// Paid checkout is off until STRIPE_SECRET_KEY is set — free tickets (UCSD-
// affiliated, or public events with no price) don't depend on this at all.
export const stripeEnabled = !!process.env.STRIPE_SECRET_KEY;

export const stripe = stripeEnabled ? new Stripe(process.env.STRIPE_SECRET_KEY!) : null;
