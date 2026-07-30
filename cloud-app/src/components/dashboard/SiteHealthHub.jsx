import { useState, useEffect, useRef } from 'react';
import { Activity, RefreshCw, Loader2, ShieldAlert, Zap, BookOpen, ChevronRight, Globe, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';

const categoryConfig = {
  security: { icon: ShieldAlert, color: 'text-destructive', bg: 'bg-destructive/10', label: 'Security' },
  performance: { icon: Activity, color: 'text-chart-4', bg: 'bg-chart-4/10', label: 'Performance' },
  functionality: { icon: AlertCircle, color: 'text-chart-2', bg: 'bg-chart-2/10', label: 'Functionality' },
  design: { icon: Zap, color: 'text-chart-5', bg: 'bg-chart-5/10', label: 'Design' },
};

export default function SiteHealthHub() {
  const [domains, setDomains] = useState([]);
  const [selectedDomainId, setSelectedDomainId] = useState(null);
  const [scan, setScan] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef(null);

  useEffect(() => {
    fetchDomains();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  useEffect(() => {
    if (selectedDomainId) {
      setScan(null);
      setScanning(false);
      if (pollRef.current) clearInterval(pollRef.current);
      checkExistingScan();
    }
  }, [selectedDomainId]);

  const fetchDomains = async () => {
    try {
      const data = await base44.entities.Domain.list('-last_active', 100);
      setDomains(data);
      if (data.length > 0) setSelectedDomainId(data[0].id);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const checkExistingScan = async () => {
    try {
      const res = await base44.functions.invoke('siteHealthScan', {
        action: 'get_latest',
        domain_id: selectedDomainId,
      });
      const latestScan = res.data?.scan;
      if (!latestScan) {
        startScan();
      } else if (latestScan.status === 'scanning') {
        setScan(latestScan);
        setScanning(true);
        pollStatus(latestScan.id);
        if (latestScan.progress === 0) {
          base44.functions.invoke('siteHealthScan', { action: 'run', scan_id: latestScan.id }).catch(console.error);
        }
      } else {
        setScan(latestScan);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const startScan = async () => {
    setScanning(true);
    setScan(null);
    try {
      const startRes = await base44.functions.invoke('siteHealthScan', {
        action: 'start',
        domain_id: selectedDomainId,
      });
      const scanId = startRes.data?.scan_id;
      if (scanId) {
        base44.functions.invoke('siteHealthScan', { action: 'run', scan_id: scanId }).catch(console.error);
        pollStatus(scanId);
      }
    } catch (e) {
      console.error(e);
      setScanning(false);
    }
  };

  const pollStatus = (scanId) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await base44.functions.invoke('siteHealthScan', {
          action: 'status',
          scan_id: scanId,
        });
        const data = res.data;
        setScan({
          id: scanId,
          status: data.status,
          progress: data.progress,
          current_step: data.current_step,
          issues: data.issues,
          total_issues: data.total_issues,
        });
        if (data.status === 'completed' || data.status === 'error') {
          clearInterval(pollRef.current);
          setScanning(false);
        }
      } catch (e) {
        console.error(e);
      }
    }, 1500);
  };

  if (loading) {
    return (
      <div className="glass-card p-6 mb-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading site health data...
        </div>
      </div>
    );
  }

  if (domains.length === 0) {
    return null;
  }

  return (
    <div className="glass-card overflow-hidden mb-8">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
            <ShieldAlert className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Site Health Hub</h2>
            <p className="text-[11px] text-muted-foreground">Automated scan across security, performance, functionality & design</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedDomainId || ''}
            onChange={(e) => setSelectedDomainId(e.target.value)}
            className="bg-card border border-border rounded-md px-2.5 py-1.5 text-xs text-foreground"
          >
            {domains.map(d => (
              <option key={d.id} value={d.id}>{d.domain_name}</option>
            ))}
          </select>
          <button
            onClick={startScan}
            disabled={scanning}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {scanning ? 'Scanning...' : 'Re-Scan'}
          </button>
        </div>
      </div>

      <div className="p-5">
        {scanning && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-sm text-foreground">{scan?.current_step || 'Initializing...'}</span>
              </div>
              <span className="text-sm font-mono text-muted-foreground">{scan?.progress || 0}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500 ease-out"
                style={{ width: `${scan?.progress || 0}%` }}
              />
            </div>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              {['Fetching context', 'Diagnostics', 'Homepage', 'Headers', 'AI synthesis'].map((step, idx) => {
                const threshold = (idx + 1) * 20;
                const done = (scan?.progress || 0) >= threshold;
                return (
                  <div key={step} className={`flex items-center gap-1 ${done ? 'text-primary' : ''}`}>
                    {done ? <CheckCircle2 className="w-3 h-3" /> : <div className="w-3 h-3 rounded-full border border-muted-foreground/30" />}
                    {step}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!scanning && scan && scan.status === 'completed' && (
          <div>
            {scan.issues && scan.issues.length > 0 ? (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="w-4 h-4 text-chart-4" />
                  <span className="text-sm font-medium text-foreground">{scan.total_issues} issues found — review and resolve below</span>
                  <span className="text-[11px] text-muted-foreground ml-auto">Last scan: {scan.scan_date ? new Date(scan.scan_date).toLocaleString() : 'just now'}</span>
                </div>
                <div className="space-y-2">
                  {scan.issues.map((issue, idx) => {
                    const cat = categoryConfig[issue.category] || categoryConfig.functionality;
                    const CatIcon = cat.icon;
                    return (
                      <div key={idx} className="rounded-md border border-border bg-background/50 p-3">
                        <div className="flex items-start gap-2.5">
                          <div className={`w-7 h-7 rounded-md ${cat.bg} flex items-center justify-center shrink-0`}>
                            <CatIcon className={`w-3.5 h-3.5 ${cat.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <p className="text-sm font-medium text-foreground">{issue.title}</p>
                              <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${cat.bg} ${cat.color} uppercase`}>{cat.label}</span>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full uppercase ${issue.severity === 'critical' ? 'bg-destructive/10 text-destructive' : 'bg-chart-4/10 text-chart-4'}`}>
                                {issue.severity}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mb-2">{issue.description}</p>
                            <div className="flex items-center gap-2">
                              <Link
                                to="/knowledge-base"
                                className="flex items-center gap-1 px-2.5 py-1 rounded-md border border-border text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                              >
                                <BookOpen className="w-3 h-3" />
                                View Guide
                              </Link>
                              <Link
                                to={`/chat?prefill=${encodeURIComponent(issue.fix_description)}`}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary text-primary-foreground text-[11px] font-medium hover:bg-primary/90 transition-colors"
                              >
                                <Zap className="w-3 h-3" />
                                Fix With Pilot
                              </Link>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 py-4">
                <CheckCircle2 className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm font-medium text-foreground">No issues detected</p>
                  <p className="text-xs text-muted-foreground">Your site appears to be in good health. Last scan: {scan.scan_date ? new Date(scan.scan_date).toLocaleString() : 'just now'}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {!scanning && scan && scan.status === 'error' && (
          <div className="flex items-center gap-2 py-4">
            <AlertCircle className="w-5 h-5 text-destructive" />
            <div>
              <p className="text-sm font-medium text-foreground">Scan encountered an error</p>
              <p className="text-xs text-muted-foreground">{scan.current_step || 'Unknown error'}. Click Re-Scan to try again.</p>
            </div>
          </div>
        )}

        {!scanning && !scan && (
          <div className="flex items-center gap-2 py-4">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Checking for existing scans...</p>
          </div>
        )}
      </div>
    </div>
  );
}