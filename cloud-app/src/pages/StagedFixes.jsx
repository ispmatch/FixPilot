import { useState, useEffect } from 'react';
import { FlaskConical, ExternalLink, Check, X, GitMerge, Clock, ChevronDown, Link2, Info, Copy, Plus, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const statusConfig = {
  creating: { color: 'text-muted-foreground', bg: 'bg-muted', label: 'Creating' },
  ready: { color: 'text-chart-2', bg: 'bg-chart-2/10', label: 'Ready' },
  testing: { color: 'text-chart-4', bg: 'bg-chart-4/10', label: 'Testing' },
  approved: { color: 'text-primary', bg: 'bg-primary/10', label: 'Approved' },
  rejected: { color: 'text-muted-foreground', bg: 'bg-muted', label: 'Rejected' },
  expired: { color: 'text-muted-foreground', bg: 'bg-muted', label: 'Expired' },
  error: { color: 'text-destructive', bg: 'bg-destructive/10', label: 'Error' },
};

export default function StagedFixes() {
  const [fixes, setFixes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [acting, setActing] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [tokenPreview, setTokenPreview] = useState(null);
  const [creatingTest, setCreatingTest] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) setTokenPreview(token);
    fetchFixes();
  }, []);

  const fetchFixes = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.StagedFix.list('-created_date', 100);
      setFixes(data);
      if (tokenPreview) {
        const match = data.find(f => f.preview_token === tokenPreview);
        if (match) setExpandedId(match.id);
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleAction = async (action, fixId) => {
    setActing(fixId);
    try {
      await base44.functions.invoke('manageStaging', { action, staged_fix_id: fixId });
      await fetchFixes();
    } catch (e) { console.error(e); } finally { setActing(null); }
  };

  const copyLink = async (fix) => {
    const url = `${window.location.origin}/staged-fixes?token=${fix.preview_token}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch (e) {
      // Fallback for browsers without clipboard API
      const textarea = document.createElement('textarea');
      textarea.value = url;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try { document.execCommand('copy'); } catch {}
      document.body.removeChild(textarea);
    }
    setCopiedId(fix.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const createTestStaging = async () => {
    setCreatingTest(true);
    try {
      await base44.functions.invoke('manageStaging', {
        action: 'create_staging',
        domain_name: 'test-site.example.com',
        fix_description: '[TEST] Center hero image on mobile devices',
        json_instruction: JSON.stringify({
          changes: [{ change_type: 'css_inject', target: '.hero-image', value: '@media (max-width: 768px) { .hero-image { text-align: center; } }', explanation: 'Centers hero image on mobile screens' }],
        }),
        fix_category: 'css',
      });
      await fetchFixes();
    } catch (e) { console.error(e); } finally { setCreatingTest(false); }
  };

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <FlaskConical className="w-6 h-6 text-primary" /> Staged Fix Previews
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Sandbox preview of fixes before they go live — test, review, and merge with confidence</p>
        </div>
        <button
          onClick={createTestStaging}
          disabled={creatingTest}
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50"
        >
          {creatingTest ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          {creatingTest ? 'Creating...' : 'Create Test Staging'}
        </button>
      </div>

      {/* Info banner */}
      <div className="mb-4 rounded-lg border border-chart-2/20 bg-chart-2/5 px-4 py-3 flex items-start gap-2">
        <Info className="w-4 h-4 text-chart-2 shrink-0 mt-0.5" />
        <div className="text-xs text-foreground space-y-1">
          <p><strong>How staging works:</strong> When a staged fix is created, the system generates a preview record with the fix configuration and AI-generated notes on what to verify.</p>
          <p><strong>Preview link:</strong> Click "Copy Preview Link" to get a shareable URL. Opening it loads this page with the fix details expanded — share it with clients or team members for review before merging to live.</p>
          <p><strong>WordPress plugin:</strong> The actual staging environment (applying the fix to a copy of your site) is handled by the WP plugin. This dashboard manages the review workflow — approve, reject, or merge.</p>
          <p><strong>Test it:</strong> Click "Create Test Staging" above to generate a sample staged fix and try the full review flow.</p>
        </div>
      </div>

      {tokenPreview && (
        <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 flex items-center gap-2">
          <ExternalLink className="w-4 h-4 text-primary" />
          <p className="text-xs text-foreground">You're viewing a shared staging preview. Review the fix details below and approve or reject.</p>
        </div>
      )}

      <div className="space-y-3">
        {loading ? (
          <div className="text-center text-sm text-muted-foreground py-12">Loading staged fixes...</div>
        ) : fixes.length === 0 ? (
          <div className="glass-card px-4 py-12 text-center">
            <FlaskConical className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No staged fixes yet. Click "Create Test Staging" to try the review flow, or staged previews are created automatically from the AI Chat when you choose to preview before applying.</p>
          </div>
        ) : (
          fixes.map((fix) => {
            const config = statusConfig[fix.status] || statusConfig.creating;
            const isExpired = fix.expires_at && new Date(fix.expires_at) < new Date();
            const canAct = fix.status === 'ready' && !isExpired;
            let stagingConfig = {};
            try { stagingConfig = JSON.parse(fix.staging_config || '{}'); } catch {}
            return (
              <div key={fix.id} className="glass-card overflow-hidden">
                <button onClick={() => setExpandedId(expandedId === fix.id ? null : fix.id)} className="w-full flex items-center gap-4 px-4 py-3 hover:bg-muted/30 text-left">
                  <div className={`w-8 h-8 rounded-md flex items-center justify-center ${config.bg}`}>
                    <FlaskConical className={`w-4 h-4 ${config.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{fix.fix_description}</p>
                    <p className="text-xs text-muted-foreground">{fix.domain_name} · {new Date(fix.created_date).toLocaleString()}</p>
                  </div>
                  {fix.merged_to_live && <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">Merged to Live</span>}
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${config.bg} ${config.color}`}>{isExpired && fix.status === 'ready' ? 'expired' : fix.status}</span>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform shrink-0 ${expandedId === fix.id ? 'rotate-180' : ''}`} />
                </button>
                {expandedId === fix.id && (
                  <div className="px-4 pb-4 pl-16 space-y-3">
                    {fix.expires_at && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="w-3.5 h-3.5" />
                        Expires: {new Date(fix.expires_at).toLocaleString()}
                        {isExpired && <span className="text-destructive">(expired)</span>}
                      </div>
                    )}
                    {stagingConfig.staging_notes && (
                      <div className="rounded-md border border-chart-2/20 bg-chart-2/5 p-3">
                        <p className="text-xs font-semibold text-foreground mb-1">Staging Preview Notes</p>
                        <p className="text-xs text-muted-foreground">{stagingConfig.staging_notes}</p>
                      </div>
                    )}
                    {fix.staging_config && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Staging Configuration</p>
                        <pre className="code-block">{fix.staging_config}</pre>
                      </div>
                    )}
                    {canAct && (
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => copyLink(fix)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors ${copiedId === fix.id ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                        >
                          {copiedId === fix.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          {copiedId === fix.id ? 'Copied!' : 'Copy Preview Link'}
                        </button>
                        <button onClick={() => handleAction('approve', fix.id)} disabled={acting === fix.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50">
                          <Check className="w-3.5 h-3.5" /> Approve
                        </button>
                        <button onClick={() => handleAction('reject', fix.id)} disabled={acting === fix.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-muted-foreground text-xs font-medium hover:text-foreground hover:bg-muted disabled:opacity-50">
                          <X className="w-3.5 h-3.5" /> Reject
                        </button>
                        <button onClick={() => handleAction('merge', fix.id)} disabled={acting === fix.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-primary/30 text-primary text-xs font-medium hover:bg-primary/10 disabled:opacity-50">
                          <GitMerge className="w-3.5 h-3.5" /> Merge to Live
                        </button>
                      </div>
                    )}
                    {fix.status === 'approved' && !fix.merged_to_live && (
                      <button onClick={() => handleAction('merge', fix.id)} disabled={acting === fix.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-primary/30 text-primary text-xs font-medium hover:bg-primary/10 disabled:opacity-50">
                        <GitMerge className="w-3.5 h-3.5" /> Merge to Live
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}