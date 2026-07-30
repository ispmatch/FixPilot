import { useState } from 'react';
import { Activity, Globe, Clock, Server, Shield, AlertCircle, RefreshCw, Search } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const statusConfig = {
  online: { color: 'text-primary', bg: 'bg-primary/10', label: 'Online' },
  offline: { color: 'text-destructive', bg: 'bg-destructive/10', label: 'Offline' },
  warning: { color: 'text-chart-4', bg: 'bg-chart-4/10', label: 'Warning' },
  error: { color: 'text-destructive', bg: 'bg-destructive/10', label: 'Error' },
  timeout: { color: 'text-chart-4', bg: 'bg-chart-4/10', label: 'Timeout' },
  not_wordpress: { color: 'text-muted-foreground', bg: 'bg-muted', label: 'Not WP' },
};

export default function SiteStatusPing() {
  const [domain, setDomain] = useState('');
  const [pinging, setPinging] = useState(false);
  const [pingingAll, setPingingAll] = useState(false);
  const [results, setResults] = useState([]);

  const pingDomain = async (domainName) => {
    setPinging(true);
    try {
      const response = await base44.functions.invoke('sitePing', { action: 'ping', domain_name: domainName });
      const data = response.data;
      setResults(prev => {
        const filtered = prev.filter(r => r.domain_name !== data.domain_name);
        return [data, ...filtered];
      });
    } catch (e) {
      console.error(e);
    } finally {
      setPinging(false);
    }
  };

  const pingAll = async () => {
    setPingingAll(true);
    try {
      const response = await base44.functions.invoke('sitePing', { action: 'ping_all' });
      setResults(response.data.results || []);
    } catch (e) {
      console.error(e);
    } finally {
      setPingingAll(false);
    }
  };

  const handlePing = () => {
    if (!domain.trim()) return;
    pingDomain(domain.trim());
    setDomain('');
  };

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" /> Site Status Ping
        </h2>
        <button onClick={pingAll} disabled={pingingAll} className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border text-xs font-medium hover:bg-muted disabled:opacity-50 text-foreground">
          <RefreshCw className={`w-3.5 h-3.5 ${pingingAll ? 'animate-spin' : ''}`} />
          {pingingAll ? 'Pinging All...' : 'Ping All Sites'}
        </button>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handlePing()}
            placeholder="Enter any domain to ping (e.g. example.com)..."
            className="w-full bg-card border border-border rounded-md pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50"
          />
        </div>
        <button onClick={handlePing} disabled={pinging || !domain.trim()} className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50">
          {pinging ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
          Ping
        </button>
      </div>

      {results.length === 0 ? (
        <div className="glass-card px-4 py-8 text-center">
          <Activity className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Enter any domain above to check its status, or ping all registered sites at once.</p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="divide-y divide-border">
            {results.map((r, idx) => {
              const config = statusConfig[r.status] || statusConfig.offline;
              return (
                <div key={idx} className="flex items-center gap-4 px-4 py-3">
                  <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${config.bg}`}>
                    {r.status === 'online' ? <Globe className={`w-4 h-4 ${config.color}`} /> : <AlertCircle className={`w-4 h-4 ${config.color}`} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{r.domain_name}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {r.is_wordpress && <span className="flex items-center gap-1"><Shield className="w-3 h-3 text-primary" /> WP {r.wp_version || 'detected'}</span>}
                      {r.server && <span className="flex items-center gap-1"><Server className="w-3 h-3" /> {r.server.substring(0, 30)}</span>}
                      {r.ssl_valid ? <span className="text-primary">SSL ✓</span> : <span className="text-destructive">No SSL</span>}
                      {r.note && <span className="text-chart-4">{r.note}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {r.response_time_ms > 0 && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" /> {r.response_time_ms}ms
                      </span>
                    )}
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${config.bg} ${config.color}`}>{config.label}</span>
                    {r.status_code > 0 && <span className="text-[10px] font-mono text-muted-foreground">{r.status_code}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}