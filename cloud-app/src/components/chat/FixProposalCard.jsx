import { useState } from 'react';
import { Check, X, Code2, Settings, FileText, Database, Wrench, ChevronDown, ChevronUp, Lightbulb, Loader2, ShieldCheck } from 'lucide-react';

const categoryConfig = {
  css: { icon: Code2, label: 'CSS / Design', color: 'text-chart-1', bg: 'bg-chart-1/10' },
  settings: { icon: Settings, label: 'Plugin Settings', color: 'text-chart-2', bg: 'bg-chart-2/10' },
  content: { icon: FileText, label: 'Content', color: 'text-chart-4', bg: 'bg-chart-4/10' },
  database: { icon: Database, label: 'Database', color: 'text-chart-5', bg: 'bg-chart-5/10' },
  other: { icon: Wrench, label: 'Other', color: 'text-chart-3', bg: 'bg-chart-3/10' },
};

export default function FixProposalCard({ proposal, onConfirm, onReject, hasQuota, executing }) {
  const [expandedChange, setExpandedChange] = useState(null);
  const plan = proposal.fix_plan || proposal;
  const cat = categoryConfig[plan.category] || categoryConfig.other;
  const CatIcon = cat.icon;

  return (
    <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 bg-primary/10 border-b border-primary/20">
        <div className={`w-7 h-7 rounded-md ${cat.bg} flex items-center justify-center`}>
          <CatIcon className={`w-4 h-4 ${cat.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground">Proposed Fix — {cat.label}</p>
          <p className="text-xs text-muted-foreground truncate">{plan.description}</p>
        </div>
      </div>

      <div className="px-4 py-3 space-y-3">
        {plan.reasoning && (
          <div className="flex gap-2 text-xs text-muted-foreground">
            <Lightbulb className="w-3.5 h-3.5 shrink-0 mt-0.5 text-chart-4" />
            <p>{plan.reasoning}</p>
          </div>
        )}

        {plan.changes && plan.changes.length > 0 && (
          <div className="space-y-1.5">
            {plan.changes.map((change, idx) => (
              <div key={idx} className="rounded-md border border-border bg-card/50">
                <button
                  onClick={() => setExpandedChange(expandedChange === idx ? null : idx)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left"
                >
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase">
                    {change.change_type}
                  </span>
                  <span className="text-xs text-foreground flex-1 truncate">{change.target}</span>
                  {expandedChange === idx ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                </button>
                {expandedChange === idx && (
                  <div className="px-3 pb-3 space-y-2">
                    <p className="text-xs text-muted-foreground">{change.explanation}</p>
                    {change.value && (
                      <pre className="code-block text-[11px] whitespace-pre-wrap break-all">{change.value}</pre>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {plan.verification_plan && plan.verification_plan.length > 0 && (
          <div className="rounded-md border border-chart-2/20 bg-chart-2/5 p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <ShieldCheck className="w-3.5 h-3.5 text-chart-2" />
              <p className="text-xs font-semibold text-foreground">Post-Fix Verification Plan</p>
            </div>
            <p className="text-[11px] text-muted-foreground mb-2">After applying, the system will automatically check your live site to confirm the fix worked:</p>
            <div className="space-y-1">
              {plan.verification_plan.map((check, idx) => (
                <div key={idx} className="flex items-start gap-1.5 text-[11px]">
                  <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-muted text-muted-foreground uppercase shrink-0 mt-0.5">
                    {check.check_type}
                  </span>
                  <span className="text-muted-foreground">{check.description}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          {hasQuota ? (
            <>
              <button
                onClick={onConfirm}
                disabled={executing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {executing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                {executing ? 'Applying...' : 'Confirm & Apply'}
              </button>
              <button
                onClick={onReject}
                disabled={executing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-muted-foreground text-xs font-medium hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
              >
                <X className="w-3.5 h-3.5" />
                Reject
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2 w-full">
              <p className="text-xs text-destructive flex-1">Fix quota exhausted — upgrade your plan to apply this fix.</p>
              <a href="/subscription" className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90">
                Upgrade
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}