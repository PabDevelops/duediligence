import Stripe from 'stripe';
import { supabase } from '../../../../lib/supabase';

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
  const body = await request.text();
  const sig = request.headers.get('stripe-signature');

  let event;
  try {
    const stripeClient = getStripe();
    event = stripeClient.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata.userId;
    const subscriptionId = session.subscription;

    const stripeClient = getStripe();
    const subscription = await stripeClient.subscriptions.retrieve(subscriptionId);

    await supabase.from('subscriptions').upsert({
      user_id: userId,
      stripe_subscription_id: subscriptionId,
      stripe_customer_id: session.customer,
      status: subscription.status,
      trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    });

    // Unlock pro_subscriber achievement (best-effort)
    try {
      const { data: existing } = await supabase
        .from('user_achievements')
        .select('id')
        .eq('user_id', userId)
        .eq('achievement_type', 'pro_subscriber')
        .single();
      if (!existing) {
        await supabase.from('user_achievements').insert([{ user_id: userId, achievement_type: 'pro_subscriber' }]);
      }
    } catch (_) {}
  }

  if (event.type === 'customer.subscription.updated') {
    const subscription = event.data.object;
    await supabase.from('subscriptions').update({
      status: subscription.status,
      trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq('stripe_subscription_id', subscription.id);
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object;
    await supabase.from('subscriptions').update({ status: 'cancelled' })
      .eq('stripe_subscription_id', subscription.id);
  }

  return Response.json({ received: true });
}