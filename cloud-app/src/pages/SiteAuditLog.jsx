import { useState, useEffect } from 'react';
import { ScrollText, Filter, ChevronDown, CheckCircle2, AlertTriangle, FileCode, ToggleRight, ToggleLeft, UserPlus, UserMinus, Palette, Settings } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const changeTypeConfig = {
  plugin_activated: { icon: ToggleRight, label: 'Plugin Activated' },
  plugin_deactivated: { icon: ToggleLeft, label: 'Plugin Deactivated' },
  theme_change: { icon: Palette, label: 'Theme Changed' },
  file_modified: { icon: FileCode, label: 'File Modified' },
  setting_changed: { icon: Settings, label: 'Setting Changed' },
  user_created: { icon: UserPlus, label: 'User Created' },
  user_deleted: { icon: UserMinus, label: 'User Deleted' },
  core_updated: { icon: AlertTriangle, label: 'Core Updated' },
  other: { icon: ScrollText, label: 'Other' },
};

const severityConfig = {
  info: 'text-muted-foreground bg-muted',
  warning: 'text-chart-4 bg-chart-4/10',
  critical: 'text-destructive bg-destructive/10',
};

export default function SiteAuditLog() {
  const [audits, setAudits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [filterSeverity, setFilterSeverity] = useState('all');

  useEffect(() => { fetchAudits(); }, []);

  const fetchAudits = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.SiteAudit.list('-created_date', 200);
      setAudits(data);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const acknowledge = async (auditId) => {
    await base44.entities.SiteAudit.update(auditId, { acknowledged: true });
    await fetchAudits();
  };

  const filtered = audits.filter(a => {
    if (filterType !== 'all' && a.change_type !== filterType) return false;
    if (filterSeverity !== 'all' && a.severity !== filterSeverity) return false;
    return true;
  });

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
          <ScrollText className="w-6 h-6 text-primary" /> Change Audit Log
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Track plugin, theme, and configuration changes across all monitored sites</p>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="bg-card border border-border rounded-md px-3 py-1.5 text-sm text-foreground">
          <option value="all">All Change Types</option>
          {Object.entries(changeTypeConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)} className="bg-card border border-border rounded-md px-3 py-1.5 text-sm text-foreground">
          <option value="all">All Severities</option>
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="critical">Critical</option>
        </select>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} entries</span>
      </div>

      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">Loading audit log...</div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <ScrollText className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No audit entries yet. Changes will appear here when detected by scheduled scans or the plugin.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((audit) => {
              const config = changeTypeConfig[audit.change_type] || changeTypeConfig.other;
              const Icon = config.icon;
              let diffDetails = null;
              try { diffDetails = JSON.parse(audit.diff_details || '{}'); } catch {}
              return (
                <div key={audit.id}>
                  <button onClick={() => setExpandedId(expandedId === audit.id ? null : audit.id)} className="w-full flex items-center gap-4 px-4 py-3 hover:bg-muted/30 text-left">
                    <div className="w-8 h-8 rounded-md flex items-center justify-center bg-muted/50">
                      <Icon className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{audit.description}</p>
                      <p className="text-xs text-muted-foreground">{audit.domain_name} · {new Date(audit.audit_date || audit.created_date).toLocaleString()} · by {audit.detected_by}</p>
                    </div>
                    <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">{audit.change_type}</span>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${severityConfig[audit.severity] || severityConfig.info}`}>{audit.severity}</span>
                    {audit.acknowledged && <CheckCircle2 className="w-4 h-4 text-muted-foreground shrink-0" />}
                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform shrink-0 ${expandedId === audit.id ? 'rotate-180' : ''}`} />
                  </button>
                  {expandedId === audit.id && (
                    <div className="px-4 pb-4 pl-16 space-y-3">
                      {diffDetails && Object.keys(diffDetails).length > 0 && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Change Details</p>
                          <pre className="code-block">{JSON.stringify(diffDetails, null, 2)}</pre>
                        </div>
                      )}
                      {!audit.acknowledged && (
                        <button onClick={() => acknowledge(audit.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-muted-foreground text-xs font-medium hover:text-foreground hover:bg-muted">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Acknowledge
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}