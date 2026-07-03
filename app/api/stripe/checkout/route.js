import Stripe from 'stripe';
import { getUserId } from '../../../../lib/auth';
import { supabase } from '../../../../lib/supabase';
import { TRIAL_DAYS } from '../../../../lib/trialConfig';

let stripe;

function getStripe() {
  if (!stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not set');
    }
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripe;
}

export async function POST(request) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const { priceId } = await request.json();

  const allowedPrices = [process.env.STRIPE_PRICE_MONTHLY, process.env.STRIPE_PRICE_ANNUAL];
  if (!allowedPrices.includes(priceId)) {
    return Response.json({ error: 'Invalid price' }, { status: 400 });
  }

  try {
    const { data: existingSub } = await supabase
      .from('subscriptions')
      .select('user_id')
      .eq('user_id', userId)
      .single();

    const stripeClient = getStripe();
    const session = await stripeClient.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
      metadata: { userId },
      client_reference_id: userId,
      ...(existingSub ? {} : { subscription_data: { trial_period_days: TRIAL_DAYS } }),
    });

    return Response.json({ url: session.url });
  } catch (e) {
    console.error(e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}