import { useState, useEffect } from 'react';
import { Check, Zap, Star, Crown, Rocket, Loader2, AlertCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const plans = [
  { tier: 'free', name: 'Free', price: 0, fixes: 3, icon: Zap, features: ['3 lifetime fixes', 'CSS & design fixes', 'Plugin settings', 'Community support'], cta: 'Current Plan' },
  { tier: 'starter', name: 'Starter', price: 25, fixes: 10, icon: Rocket, features: ['10 fixes per month', 'All fix types', 'Fix history & rollback', 'Email support'], cta: 'Upgrade to Starter' },
  { tier: 'pro', name: 'Pro', price: 50, fixes: 25, icon: Star, features: ['25 fixes per month', 'Priority AI research', 'Knowledge base recipes', 'Priority support'], cta: 'Upgrade to Pro', popular: true },
  { tier: 'business', name: 'Business', price: 100, fixes: 60, icon: Crown, features: ['60 fixes per month', 'Dedicated AI model', 'Team access', 'Slack support channel'], cta: 'Upgrade to Business' },
];

export default function Subscription() {
  const [domains, setDomains] = useState([]);
  const [selectedDomain, setSelectedDomain] = useState(null);
  const [loading, setLoading] = useState(true);
  const [redirectingTier, setRedirectingTier] = useState(null);
  const [statusMsg, setStatusMsg] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('status');
    if (status === 'success') {
      setStatusMsg({ type: 'success', text: 'Payment successful! Your subscription is now active and fix quota has been reset.' });
    } else if (status === 'cancelled') {
      setStatusMsg({ type: 'cancelled', text: 'Checkout was cancelled. No changes were made to your plan.' });
    }
    fetchDomains();
  }, []);

  const fetchDomains = async () => {
    try {
      const data = await base44.entities.Domain.list('-created_date', 50);
      setDomains(data);
      if (data.length > 0) setSelectedDomain(data[0]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (plan) => {
    if (!selectedDomain) return;

    // Block checkout if running inside an iframe (e.g. Base44 preview)
    if (window.self !== window.top) {
      alert('Checkout is only available from the published app. Please open the app in a new tab to upgrade.');
      return;
    }

    setRedirectingTier(plan.tier);
    try {
      const response = await base44.functions.invoke('stripeCheckout', {
        domain_id: selectedDomain.id,
        tier: plan.tier,
      });
      const { url } = response.data;
      if (url) {
        window.location.href = url;
      } else {
        alert('Failed to create checkout session. Please try again.');
        setRedirectingTier(null);
      }
    } catch (e) {
      alert('Checkout error: ' + (e.message || 'Unknown error'));
      setRedirectingTier(null);
    }
  };

  const used = selectedDomain?.fix_count_used || 0;
  const limit = selectedDomain?.fix_count_limit || 3;
  const pct = Math.min((used / limit) * 100, 100);
  const currentTier = selectedDomain?.subscription_tier || 'free';

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Subscription & Billing</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your plan, fix quota, and Stripe billing</p>
      </div>

      {statusMsg && (
        <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
          statusMsg.type === 'success' ? 'bg-primary/10 border border-primary/30' : 'bg-muted border border-border'
        }`}>
          {statusMsg.type === 'success'
            ? <Check className="w-5 h-5 text-primary shrink-0" />
            : <AlertCircle className="w-5 h-5 text-muted-foreground shrink-0" />}
          <p className="text-sm text-foreground">{statusMsg.text}</p>
        </div>
      )}

      {selectedDomain && (
        <div className="glass-card p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs text-muted-foreground">Current Plan for</p>
              <p className="text-lg font-semibold text-foreground">{selectedDomain.domain_name}</p>
            </div>
            <select
              value={selectedDomain.id}
              onChange={(e) => setSelectedDomain(domains.find(d => d.id === e.target.value))}
              className="bg-card border border-border rounded-md px-3 py-1.5 text-sm text-foreground"
            >
              {domains.map(d => <option key={d.id} value={d.id}>{d.domain_name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-6">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Plan</p>
              <p className="text-xl font-bold text-primary capitalize">{currentTier}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Fixes Used</p>
              <p className="text-xl font-bold text-foreground">{used} / {limit}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Status</p>
              <p className={`text-sm font-semibold capitalize ${selectedDomain.subscription_status === 'active' ? 'text-primary' : 'text-muted-foreground'}`}>
                {selectedDomain.subscription_status}
              </p>
            </div>
          </div>

          <div className="mt-4">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Fix Quota</span>
              <span>{used} of {limit} used</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className={`h-full transition-all ${pct >= 100 ? 'bg-destructive' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-4 gap-4">
        {plans.map((plan) => {
          const Icon = plan.icon;
          const isCurrent = currentTier === plan.tier;
          return (
            <div
              key={plan.tier}
              className={`glass-card p-5 flex flex-col relative ${plan.popular ? 'border-primary/40 accent-glow' : ''}`}
            >
              {plan.popular && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold">
                  POPULAR
                </span>
              )}
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${plan.popular ? 'bg-primary/10' : 'bg-muted'}`}>
                <Icon className={`w-5 h-5 ${plan.popular ? 'text-primary' : 'text-muted-foreground'}`} />
              </div>
              <h3 className="text-sm font-bold text-foreground">{plan.name}</h3>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-bold text-foreground">${plan.price}</span>
                <span className="text-xs text-muted-foreground">/mo</span>
              </div>
              <p className="text-xs text-primary font-medium mt-1">{plan.fixes} fixes</p>

              <ul className="space-y-1.5 mt-4 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <Check className="w-3 h-3 text-primary shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleUpgrade(plan)}
                disabled={isCurrent || redirectingTier !== null}
                className={`mt-4 w-full py-2 rounded-md text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                  isCurrent
                    ? 'bg-muted text-muted-foreground cursor-default'
                    : plan.popular
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'border border-border text-foreground hover:bg-muted'
                }`}
              >
                {redirectingTier === plan.tier ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Redirecting...
                  </>
                ) : isCurrent ? 'Current Plan' : plan.cta}
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-6 glass-card p-4">
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground">Free tier policy:</strong> 3 lifetime fixes per domain. Domain fingerprinting prevents re-installation to reset the free trial. Unused monthly fixes do not roll over. Cancellation reverts to 0 remaining fixes until payment resumes.
        </p>
      </div>
    </div>
  );
}