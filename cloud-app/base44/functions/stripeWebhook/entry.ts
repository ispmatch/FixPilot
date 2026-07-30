import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Stripe from 'npm:stripe@17.7.0';

const TIER_FIX_LIMITS = {
  starter: 10,
  pro: 25,
  business: 60,
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

    const body = await req.text();
    const signature = req.headers.get('stripe-signature');
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

    if (!signature || !webhookSecret) {
      console.error('[stripeWebhook] Missing signature or webhook secret');
      return Response.json({ error: 'Missing signature or webhook secret' }, { status: 400 });
    }

    let event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err) {
      console.error('[stripeWebhook] Signature verification failed:', err.message);
      return Response.json({ error: 'Invalid signature' }, { status: 400 });
    }

    console.log('[stripeWebhook] Received event:', event.type);

    // ─── checkout.session.completed ───
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const metadata = session.metadata || {};
      const domain_id = metadata.domain_id;
      const tier = metadata.tier;
      const fixLimit = parseInt(metadata.fix_limit || '0', 10);

      if (domain_id) {
        // Fetch customer and subscription IDs
        const customerId = session.customer;
        const subscriptionId = session.subscription;

        // Fetch subscription to get its metadata (more reliable)
        let subMetadata = metadata;
        if (subscriptionId) {
          try {
            const sub = await stripe.subscriptions.retrieve(subscriptionId);
            subMetadata = { ...metadata, ...sub.metadata };
          } catch (e) {
            console.error('[stripeWebhook] Failed to retrieve subscription:', e.message);
          }
        }

        const finalTier = subMetadata.tier || tier;
        const finalFixLimit = parseInt(subMetadata.fix_limit || String(fixLimit), 10) || TIER_FIX_LIMITS[finalTier] || 0;
        const finalDomainId = subMetadata.domain_id || domain_id;

        console.log('[stripeWebhook] Updating domain:', finalDomainId, {
          tier: finalTier,
          fixLimit: finalFixLimit,
          customerId,
          subscriptionId,
        });

        await base44.asServiceRole.entities.Domain.update(finalDomainId, {
          subscription_tier: finalTier,
          subscription_status: 'active',
          fix_count_limit: finalFixLimit,
          fix_count_used: 0,
          stripe_customer_id: customerId || '',
          stripe_subscription_id: subscriptionId || '',
        });

        console.log('[stripeWebhook] Domain updated successfully');
      }
    }

    // ─── invoice.paid (monthly renewal) ───
    if (event.type === 'invoice.paid') {
      const invoice = event.data.object;
      const subscriptionId = invoice.subscription;
      const parentMetadata = invoice.subscription_details?.metadata || {};

      const domainId = parentMetadata.domain_id;
      const tier = parentMetadata.tier;
      const fixLimit = parseInt(parentMetadata.fix_limit || '0', 10) || TIER_FIX_LIMITS[tier] || 0;

      // Only reset on renewal (not first invoice, which is handled by checkout.session.completed)
      if (domainId && invoice.billing_reason === 'subscription_cycle') {
        console.log('[stripeWebhook] Monthly renewal — resetting fix counter for domain:', domainId);

        await base44.asServiceRole.entities.Domain.update(domainId, {
          fix_count_used: 0,
          fix_count_limit: fixLimit,
          subscription_status: 'active',
        });

        console.log('[stripeWebhook] Fix counter reset');
      }
    }

    // ─── customer.subscription.deleted (cancellation) ───
    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      const metadata = subscription.metadata || {};
      const domainId = metadata.domain_id;

      if (domainId) {
        console.log('[stripeWebhook] Subscription cancelled — downgrading domain:', domainId);

        await base44.asServiceRole.entities.Domain.update(domainId, {
          subscription_tier: 'free',
          subscription_status: 'cancelled',
          fix_count_limit: 0,
          fix_count_used: 0,
        });

        console.log('[stripeWebhook] Domain downgraded to free');
      }
    }

    // ─── customer.subscription.updated (e.g. past_due) ───
    if (event.type === 'customer.subscription.updated') {
      const subscription = event.data.object;
      const metadata = subscription.metadata || {};
      const domainId = metadata.domain_id;
      const tier = metadata.tier;

      if (domainId) {
        const status = subscription.status;
        let domainStatus = 'active';
        if (status === 'past_due' || status === 'unpaid' || status === 'canceled') {
          domainStatus = 'past_due';
        } else if (status === 'active') {
          domainStatus = 'active';
        }

        console.log('[stripeWebhook] Subscription updated:', { domainId, stripeStatus: status, domainStatus });

        const domains = await base44.asServiceRole.entities.Domain.filter({ id: domainId });
        const domain = domains[0];
        if (domain) {
          await base44.asServiceRole.entities.Domain.update(domainId, {
            subscription_status: domainStatus,
            ...(tier && { subscription_tier: tier }),
            ...(tier && { fix_count_limit: TIER_FIX_LIMITS[tier] || domain.fix_count_limit }),
          });
        }
      }
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('[stripeWebhook] Error:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});