import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Stripe from 'npm:stripe@17.7.0';

const PRICE_MAP = {
  starter: { price_id: 'price_1Tmr4xL0t6RbLJ3vEikLq3M6', fixes: 10, name: 'Starter' },
  pro: { price_id: 'price_1Tmr4xL0t6RbLJ3vv1SpBXWa', fixes: 25, name: 'Pro' },
  business: { price_id: 'price_1Tmr4xL0t6RbLJ3vOTT2KQ4p', fixes: 60, name: 'Business' },
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { domain_id, tier, return_url } = body;

    console.log('[stripeCheckout] Request received:', { domain_id, tier });

    if (!domain_id || !tier) {
      return Response.json({ error: 'domain_id and tier are required' }, { status: 400 });
    }

    const plan = PRICE_MAP[tier];
    if (!plan) {
      return Response.json({ error: 'Invalid tier. Use: starter, pro, or business' }, { status: 400 });
    }

    // Look up the domain using service role (public app — no user auth)
    const domains = await base44.asServiceRole.entities.Domain.filter({ id: domain_id });
    const domain = domains[0];
    if (!domain) {
      return Response.json({ error: 'Domain not found' }, { status: 404 });
    }

    console.log('[stripeCheckout] Creating checkout for domain:', domain.domain_name, 'tier:', tier);

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

    // Build success/cancel URLs — use return_url if provided (e.g. from WP plugin), otherwise use origin
    let success_url, cancel_url;
    if (return_url) {
      const separator = return_url.includes('?') ? '&' : '?';
      success_url = `${return_url}${separator}status=success`;
      cancel_url = `${return_url}${separator}status=cancelled`;
    } else {
      const origin = req.headers.get('origin') || 'https://app.base44.com';
      success_url = `${origin}/subscription?status=success&domain=${domain_id}`;
      cancel_url = `${origin}/subscription?status=cancelled&domain=${domain_id}`;
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: plan.price_id, quantity: 1 }],
      success_url,
      cancel_url,
      metadata: {
        base44_app_id: Deno.env.get('BASE44_APP_ID'),
        domain_id: domain_id,
        domain_name: domain.domain_name,
        tier: tier,
        fix_limit: String(plan.fixes),
      },
      customer_email: domain.owner_email,
      subscription_data: {
        metadata: {
          base44_app_id: Deno.env.get('BASE44_APP_ID'),
          domain_id: domain_id,
          domain_name: domain.domain_name,
          tier: tier,
          fix_limit: String(plan.fixes),
        },
      },
    });

    console.log('[stripeCheckout] Session created:', session.id, 'URL:', session.url);

    return Response.json({ url: session.url });
  } catch (error) {
    console.error('[stripeCheckout] Error:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});