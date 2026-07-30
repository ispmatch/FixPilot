import { useState, useEffect } from 'react';
import { History, RotateCcw, Filter, Code2, X, ChevronDown, ShieldCheck, ShieldAlert, ShieldQuestion } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import VerificationResults from '@/components/chat/VerificationResults';
import XaiReport from '@/components/chat/XaiReport';

export default function FixHistory() {
  const [fixes, setFixes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [rollingBack, setRollingBack] = useState(null);

  useEffect(() => {
    fetchFixes();
  }, []);

  const fetchFixes = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.FixExecution.list('-created_date', 200);
      setFixes(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleRollback = async (fixId) => {
    setRollingBack(fixId);
    try {
      await base44.functions.invoke('aiFixOrchestrator', {
        action: 'rollback',
        fix_id: fixId,
      });
      await fetchFixes();
    } catch (e) {
      console.error(e);
    } finally {
      setRollingBack(null);
    }
  };

  const filtered = fixes.filter(f => {
    if (filterStatus !== 'all' && f.status !== filterStatus) return false;
    if (filterCategory !== 'all' && f.fix_category !== filterCategory) return false;
    return true;
  });

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Fix History</h1>
        <p className="text-sm text-muted-foreground mt-1">All applied fixes with before-state snapshots and rollback capability</p>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="bg-card border border-border rounded-md px-3 py-1.5 text-sm text-foreground">
          <option value="all">All Statuses</option>
          <option value="applied">Applied</option>
          <option value="reverted">Reverted</option>
          <option value="failed">Failed</option>
        </select>
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="bg-card border border-border rounded-md px-3 py-1.5 text-sm text-foreground">
          <option value="all">All Categories</option>
          <option value="css">CSS</option>
          <option value="settings">Settings</option>
          <option value="content">Content</option>
          <option value="database">Database</option>
          <option value="other">Other</option>
        </select>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} fixes</span>
      </div>

      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">Loading fixes...</div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <History className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No fixes found. Apply a fix from the AI Chat to see it here.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((fix) => (
              <div key={fix.id}>
                <button
                  onClick={() => setExpandedId(expandedId === fix.id ? null : fix.id)}
                  className="w-full flex items-center gap-4 px-4 py-3 hover:bg-muted/30 text-left"
                >
                  <div className={`w-8 h-8 rounded-md flex items-center justify-center ${fix.status === 'applied' ? 'bg-primary/10' : 'bg-chart-3/10'}`}>
                    <Code2 className={`w-4 h-4 ${fix.status === 'applied' ? 'text-primary' : 'text-chart-3'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{fix.fix_description}</p>
                    <p className="text-xs text-muted-foreground">{fix.domain_name} · {new Date(fix.created_date).toLocaleString()}</p>
                  </div>
                  <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">{fix.fix_category}</span>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${fix.status === 'applied' ? 'bg-primary/10 text-primary' : fix.status === 'reverted' ? 'bg-chart-3/10 text-chart-3' : 'bg-muted text-muted-foreground'}`}>
                    {fix.status}
                  </span>
                  {fix.verification_status && fix.verification_status !== 'pending' && fix.verification_status !== 'skipped' && (
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1 ${
                      fix.verification_status === 'passed' ? 'bg-primary/10 text-primary' :
                      fix.verification_status === 'failed' ? 'bg-destructive/10 text-destructive' :
                      'bg-chart-4/10 text-chart-4'
                    }`}>
                      {fix.verification_status === 'passed' ? <ShieldCheck className="w-3 h-3" /> :
                       fix.verification_status === 'failed' ? <ShieldAlert className="w-3 h-3" /> :
                       <ShieldQuestion className="w-3 h-3" />}
                      {fix.verification_status}
                    </span>
                  )}
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform shrink-0 ${expandedId === fix.id ? 'rotate-180' : ''}`} />
                </button>

                {expandedId === fix.id && (
                  <div className="px-4 pb-4 pl-16 space-y-3">
                    {fix.wp_version && (
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>WP {fix.wp_version}</span>
                      </div>
                    )}
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">JSON Instruction</p>
                      <pre className="code-block">{fix.json_instruction}</pre>
                    </div>
                    {fix.before_state && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Before-State Snapshot</p>
                        <pre className="code-block">{fix.before_state}</pre>
                      </div>
                    )}
                    {fix.verification_result && fix.verification_status !== 'pending' && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Verification Results</p>
                        <VerificationResults
                          results={fix.verification_result}
                          overallStatus={fix.verification_status}
                          verifying={false}
                        />
                      </div>
                    )}
                    <XaiReport fix={fix} />
                    {fix.status === 'applied' && (
                      <button
                        onClick={() => handleRollback(fix.id)}
                        disabled={rollingBack === fix.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-chart-3/30 text-chart-3 text-xs font-medium hover:bg-chart-3/10 transition-colors disabled:opacity-50"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        {rollingBack === fix.id ? 'Reverting...' : 'Revert This Fix'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}