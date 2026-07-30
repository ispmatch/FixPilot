import { useState, useEffect } from 'react';
import { Globe, Wrench, CreditCard, BookOpen, ArrowRight, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import StatCard from '@/components/dashboard/StatCard';
import SiteStatusPing from '@/components/dashboard/SiteStatusPing';
import SiteHealthHub from '@/components/dashboard/SiteHealthHub';
import { APP_VERSION } from '@/lib/version';

export default function Home() {
  const [stats, setStats] = useState({ domains: 0, fixes: 0, subscriptions: 0, recipes: 0, mrr: 0 });
  const [recentFixes, setRecentFixes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [domains, fixes, recipes] = await Promise.all([
        base44.entities.Domain.list('-created_date', 500),
        base44.entities.FixExecution.list('-created_date', 10),
        base44.entities.FixRecipe.filter({ status: 'verified' }),
      ]);

      const activeSubs = domains.filter(d => d.subscription_status === 'active');
      const tierPrices = { free: 0, starter: 25, pro: 50, business: 100 };
      const mrr = activeSubs.reduce((sum, d) => sum + (tierPrices[d.subscription_tier] || 0), 0);

      setStats({
        domains: domains.length,
        fixes: fixes.length,
        subscriptions: activeSubs.length,
        recipes: recipes.length,
        mrr,
      });
      setRecentFixes(fixes);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Platform Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">FixPilot cloud dashboard — customers, fixes, and billing at a glance · <span className="font-mono text-primary">v{APP_VERSION}</span></p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard icon={Globe} label="Registered Domains" value={loading ? '—' : stats.domains} accent="primary" />
        <StatCard icon={Wrench} label="Fixes Applied" value={loading ? '—' : stats.fixes} accent="secondary" />
        <StatCard icon={CreditCard} label="Active Subscriptions" value={loading ? '—' : stats.subscriptions} sublabel={`$${stats.mrr}/mo MRR`} accent="warning" />
        <StatCard icon={BookOpen} label="Verified Recipes" value={loading ? '—' : stats.recipes} accent="destructive" />
      </div>

      <SiteStatusPing />

      <SiteHealthHub />

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">Recent Fix Executions</h2>
            <Link to="/fix-history" className="text-xs text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="glass-card overflow-hidden">
            {recentFixes.length === 0 && !loading ? (
              <div className="px-4 py-12 text-center text-sm text-muted-foreground">No fixes applied yet.</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground px-4 py-2.5 font-semibold">Domain</th>
                    <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground px-4 py-2.5 font-semibold">Fix</th>
                    <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground px-4 py-2.5 font-semibold">Category</th>
                    <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground px-4 py-2.5 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentFixes.map((fix) => (
                    <tr key={fix.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="px-4 py-3 text-xs text-foreground">{fix.domain_name}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs truncate">{fix.fix_description}</td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{fix.fix_category}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${fix.status === 'applied' ? 'bg-primary/10 text-primary' : fix.status === 'reverted' ? 'bg-chart-3/10 text-chart-3' : 'bg-muted text-muted-foreground'}`}>
                          {fix.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-foreground mb-4">Quick Actions</h2>
          <div className="space-y-2">
            <QuickAction to="/chat" icon={Zap} label="Open AI Chat" desc="Research & apply fixes" />
            <QuickAction to="/customers" icon={Globe} label="Manage Customers" desc="View all registered domains" />
            <QuickAction to="/knowledge-base" icon={BookOpen} label="Knowledge Base" desc="Review verified fix recipes" />
            <QuickAction to="/plugin-download" icon={Wrench} label="Download Plugin" desc="Get the WP plugin PHP code" />
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickAction({ to, icon: Icon, label, desc }) {
  return (
    <Link to={to} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:border-primary/40 hover:bg-primary/5 transition-all group">
      <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
    </Link>
  );
}