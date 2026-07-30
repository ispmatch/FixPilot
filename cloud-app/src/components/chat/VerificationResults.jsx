import { CheckCircle2, XCircle, AlertCircle, Loader2, ClipboardCheck, Camera } from 'lucide-react';

const statusConfig = {
  passed: { icon: CheckCircle2, color: 'text-primary', bg: 'bg-primary/10', label: 'Passed' },
  failed: { icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/10', label: 'Failed' },
  manual: { icon: AlertCircle, color: 'text-chart-4', bg: 'bg-chart-4/10', label: 'Manual Check Needed' },
  pending: { icon: Loader2, color: 'text-muted-foreground', bg: 'bg-muted', label: 'Pending' },
  skipped: { icon: AlertCircle, color: 'text-muted-foreground', bg: 'bg-muted', label: 'Skipped' },
};

export default function VerificationResults({ results, overallStatus, verifying }) {
  if (verifying) {
    return (
      <div className="mt-3 rounded-lg border border-chart-2/30 bg-chart-2/5 overflow-hidden">
        <div className="flex items-center gap-2.5 px-4 py-3 bg-chart-2/10 border-b border-chart-2/20">
          <Loader2 className="w-4 h-4 text-chart-2 animate-spin" />
          <p className="text-xs font-semibold text-foreground">Verifying fix on live site...</p>
        </div>
        <div className="px-4 py-3">
          <p className="text-xs text-muted-foreground">Fetching your website and checking that the fix was applied correctly.</p>
        </div>
      </div>
    );
  }

  if (!results || results.length === 0) {
    return null;
  }

  let parsedResults = results;
  if (typeof results === 'string') {
    try { parsedResults = JSON.parse(results); } catch { return null; }
  }

  const overall = statusConfig[overallStatus] || statusConfig.pending;
  const OverallIcon = overall.icon;

  const hasFailures = parsedResults.some(r => r.status === 'failed');

  return (
    <div className={`mt-3 rounded-lg border overflow-hidden ${hasFailures ? 'border-destructive/30 bg-destructive/5' : 'border-primary/30 bg-primary/5'}`}>
      <div className={`flex items-center gap-2.5 px-4 py-3 border-b ${hasFailures ? 'bg-destructive/10 border-destructive/20' : 'bg-primary/10 border-primary/20'}`}>
        <div className={`w-7 h-7 rounded-md ${overall.bg} flex items-center justify-center`}>
          <OverallIcon className={`w-4 h-4 ${overall.color} ${overallStatus === 'pending' ? 'animate-spin' : ''}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <ClipboardCheck className="w-3.5 h-3.5" />
            Verification Results — {overall.label}
          </p>
          <p className="text-xs text-muted-foreground">
            {hasFailures
              ? 'Some checks failed. The fix may not have applied correctly — consider rolling back.'
              : overallStatus === 'manual'
              ? 'Automated checks passed. Manual verification steps below.'
              : 'All automated checks passed — fix confirmed on your live site.'}
          </p>
        </div>
      </div>

      <div className="px-4 py-3 space-y-2">
        {parsedResults.map((check, idx) => {
          const config = statusConfig[check.status] || statusConfig.pending;
          const Icon = config.icon;
          return (
            <div key={idx} className="flex items-start gap-2.5 p-2 rounded-md bg-background/50">
              <div className={`w-5 h-5 rounded ${config.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                <Icon className={`w-3 h-3 ${config.color} ${check.status === 'pending' ? 'animate-spin' : ''}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase shrink-0">
                    {check.check_type}
                  </span>
                  <span className={`text-[10px] font-medium ${config.color}`}>{config.label}</span>
                </div>
                <p className="text-xs text-foreground mt-0.5">{check.description}</p>
                {check.details && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">{check.details}</p>
                )}
                {check.expected && check.status === 'manual' && (
                  <p className="text-[11px] text-chart-4 mt-1 p-1.5 rounded bg-chart-4/5 border border-chart-4/20">
                    <strong>Steps:</strong> {check.expected}
                  </p>
                )}
                {check.screenshot_url && (
                  <div className="mt-2">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Camera className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Live Screenshot Proof</span>
                    </div>
                    <a href={check.screenshot_url} target="_blank" rel="noopener noreferrer" className="block rounded-md overflow-hidden border border-border hover:border-primary/40 transition-colors">
                      <img src={check.screenshot_url} alt="Live site screenshot after fix" className="w-full h-auto" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}