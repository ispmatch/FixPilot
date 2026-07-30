import { useState, useEffect } from 'react';
import { Search, Globe, Mail, CreditCard, Wrench, ChevronRight, X, Plus, Loader2, Gift, Layers, Cpu, Palette } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function Customers() {
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTier, setFilterTier] = useState('all');
  const [selected, setSelected] = useState(null);
  const [fixes, setFixes] = useState([]);
  const [setupProfile, setSetupProfile] = useState(null);
  const [learningStatus, setLearningStatus] = useState(null);
  const [detailTab, setDetailTab] = useState('overview');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    domain_name: '',
    owner_name: '',
    owner_email: '',
    wp_version: '',
    php_version: '',
    active_theme: '',
    subscription_tier: 'free',
  });
  const [creditsToAdd, setCreditsToAdd] = useState(5);
  const [addingCredits, setAddingCredits] = useState(false);

  useEffect(() => { fetchDomains(); }, []);

  const fetchDomains = async () => {
    try {
      const data = await base44.entities.Domain.list('-created_date', 500);
      setDomains(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const viewDomain = async (domain) => {
    setSelected(domain);
    setDetailTab('overview');
    try {
      const [fixData, profiles] = await Promise.all([
        base44.entities.FixExecution.filter({ domain_id: domain.id }, '-created_date', 50),
        base44.entities.SiteSetupProfile.filter({ domain_id: domain.id }),
      ]);
      setFixes(fixData);
      setSetupProfile(profiles[0] || null);
      try {
        const learnRes = await base44.functions.invoke('aiFixOrchestrator', { action: 'get_learning_status', domain_id: domain.id });
        setLearningStatus(learnRes.data);
      } catch { setLearningStatus(null); }
    } catch (e) {
      setFixes([]);
      setSetupProfile(null);
      setLearningStatus(null);
    }
  };

  const createDomain = async () => {
    if (!form.domain_name || !form.owner_email) return;
    setSaving(true);
    try {
      await base44.entities.Domain.create({
        ...form,
        subscription_status: 'none',
        fix_count_used: 0,
        fix_count_limit: form.subscription_tier === 'free' ? 3 : form.subscription_tier === 'starter' ? 25 : form.subscription_tier === 'pro' ? 100 : 500,
      });
      setShowForm(false);
      setForm({ domain_name: '', owner_name: '', owner_email: '', wp_version: '', php_version: '', active_theme: '', subscription_tier: 'free' });
      await fetchDomains();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const addCredits = async () => {
    if (!selected || !creditsToAdd || creditsToAdd <= 0) return;
    setAddingCredits(true);
    try {
      const newLimit = (selected.fix_count_limit || 3) + parseInt(creditsToAdd);
      await base44.entities.Domain.update(selected.id, { fix_count_limit: newLimit });
      setSelected({ ...selected, fix_count_limit: newLimit });
      await fetchDomains();
    } catch (e) {
      console.error(e);
    } finally {
      setAddingCredits(false);
    }
  };

  const parsePlugins = (raw) => {
    try {
      const plugins = JSON.parse(raw || '[]');
      return plugins.map(p => {
        if (typeof p === 'string') return { name: p, version: '' };
        return { name: p.name || 'Unknown', version: p.version || '' };
      });
    } catch {
      return [];
    }
  };

  const filtered = domains.filter(d => {
    if (filterTier !== 'all' && d.subscription_tier !== filterTier) return false;
    if (search && !d.domain_name.toLowerCase().includes(search.toLowerCase()) && !d.owner_email.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground mt-1">All registered WordPress domains with subscription status and fix history</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90">
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? 'Cancel' : 'Add Customer'}
        </button>
      </div>

      {showForm && (
        <div className="glass-card p-4 mb-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Domain Name *" value={form.domain_name} onChange={(v) => setForm(f => ({ ...f, domain_name: v }))} placeholder="example.com" />
            <FormField label="Owner Email *" value={form.owner_email} onChange={(v) => setForm(f => ({ ...f, owner_email: v }))} placeholder="owner@example.com" />
            <FormField label="Owner Name" value={form.owner_name} onChange={(v) => setForm(f => ({ ...f, owner_name: v }))} placeholder="John Smith" />
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Subscription Tier</label>
              <select value={form.subscription_tier} onChange={(e) => setForm(f => ({ ...f, subscription_tier: e.target.value }))} className="w-full bg-card border border-border rounded-md px-3 py-2 text-sm text-foreground">
                <option value="free">Free (3 fixes)</option>
                <option value="starter">Starter (25 fixes)</option>
                <option value="pro">Pro (100 fixes)</option>
                <option value="business">Business (500 fixes)</option>
              </select>
            </div>
            <FormField label="WordPress Version" value={form.wp_version} onChange={(v) => setForm(f => ({ ...f, wp_version: v }))} placeholder="6.4.3" />
            <FormField label="PHP Version" value={form.php_version} onChange={(v) => setForm(f => ({ ...f, php_version: v }))} placeholder="8.2" />
            <div className="col-span-2">
              <FormField label="Active Theme" value={form.active_theme} onChange={(v) => setForm(f => ({ ...f, active_theme: v }))} placeholder="Astra 4.5.1" />
            </div>
          </div>
          <button onClick={createDomain} disabled={saving || !form.domain_name || !form.owner_email} className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Create Customer'}
          </button>
        </div>
      )}

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search domains or emails..."
            className="w-full bg-card border border-border rounded-md pl-9 pr-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50"
          />
        </div>
        <select value={filterTier} onChange={(e) => setFilterTier(e.target.value)} className="bg-card border border-border rounded-md px-3 py-1.5 text-sm text-foreground">
          <option value="all">All Tiers</option>
          <option value="free">Free</option>
          <option value="starter">Starter</option>
          <option value="pro">Pro</option>
          <option value="business">Business</option>
        </select>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} domains</span>
      </div>

      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">No domains found.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground px-4 py-2.5 font-semibold">Domain</th>
                <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground px-4 py-2.5 font-semibold">Owner</th>
                <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground px-4 py-2.5 font-semibold">Tier</th>
                <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground px-4 py-2.5 font-semibold">Fixes</th>
                <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground px-4 py-2.5 font-semibold">Status</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.id} onClick={() => viewDomain(d)} className="border-b border-border/50 hover:bg-muted/30 cursor-pointer">
                  <td className="px-4 py-3 text-sm text-foreground font-medium">{d.domain_name}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{d.owner_email}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${d.subscription_tier === 'free' ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'}`}>
                      {d.subscription_tier}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{d.fix_count_used || 0} / {d.fix_count_limit || 3}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${d.subscription_status === 'active' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                      {d.subscription_status}
                    </span>
                  </td>
                  <td className="px-4 py-3"><ChevronRight className="w-4 h-4 text-muted-foreground" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setSelected(null)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative w-full max-w-md bg-card border-l border-border h-full overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">{selected.domain_name}</h2>
              </div>
              <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>

            <div className="flex gap-1 p-2 border-b border-border">
              <TabButton active={detailTab === 'overview'} onClick={() => setDetailTab('overview')}>Overview</TabButton>
              <TabButton active={detailTab === 'setup'} onClick={() => setDetailTab('setup')}>Site Setup</TabButton>
              <TabButton active={detailTab === 'history'} onClick={() => setDetailTab('history')}>Fix History</TabButton>
            </div>

            <div className="p-4 space-y-4">
              {detailTab === 'overview' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <Detail label="Owner" value={selected.owner_name || '—'} />
                    <Detail label="Email" value={selected.owner_email} icon={Mail} />
                    <Detail label="Tier" value={selected.subscription_tier} />
                    <Detail label="Fixes Used" value={`${selected.fix_count_used || 0} / ${selected.fix_count_limit || 3}`} />
                    <Detail label="WP Version" value={selected.wp_version || '—'} />
                    <Detail label="PHP Version" value={selected.php_version || '—'} />
                    <Detail label="Theme" value={selected.active_theme || '—'} />
                    <Detail label="Registered" value={new Date(selected.created_date).toLocaleDateString()} />
                  </div>

                  <div className="pt-2 border-t border-border">
                    <h3 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                      <Gift className="w-3.5 h-3.5 text-primary" />
                      Add Credits
                    </h3>
                    <p className="text-[10px] text-muted-foreground mb-2">Current limit: {selected.fix_count_limit || 3} fixes · Used: {selected.fix_count_used || 0}</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        value={creditsToAdd}
                        onChange={(e) => setCreditsToAdd(e.target.value)}
                        className="w-20 bg-card border border-border rounded-md px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-primary/50"
                      />
                      <button
                        onClick={addCredits}
                        disabled={addingCredits || !creditsToAdd || creditsToAdd <= 0}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {addingCredits ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                        Add Credits
                      </button>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1.5">Grant extra fixes to this customer (e.g. for service credits or testing).</p>
                  </div>
                </>
              )}

              {detailTab === 'setup' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <Detail label="WordPress" value={selected.wp_version || '—'} icon={Cpu} />
                    <Detail label="PHP" value={selected.php_version || '—'} icon={Cpu} />
                    <Detail label="Active Theme" value={selected.active_theme || '—'} icon={Palette} />
                    <Detail label="Page Builder" value={setupProfile?.builder_type || 'unknown'} icon={Layers} />
                    <Detail label="Setup Fingerprint" value={setupProfile?.setup_fingerprint || '—'} />
                    <Detail label="Last Active" value={selected.last_active ? new Date(selected.last_active).toLocaleString() : '—'} />
                  </div>

                  {learningStatus && (
                    <div className="p-3 rounded-md border border-primary/20 bg-primary/5">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-foreground">Learning Progress</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${learningStatus.learning_complete ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                          {learningStatus.learning_complete ? 'Complete' : 'In Progress'}
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden mb-1.5">
                        <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${learningStatus.progress_pct || 0}%` }} />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>{learningStatus.mapped_plugins || 0} / {learningStatus.total_plugins || 0} plugins mapped</span>
                        <span>{learningStatus.progress_pct || 0}%</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">{learningStatus.current_step || ''}</p>
                    </div>
                  )}

                  {setupProfile && (
                    <div>
                      <h3 className="text-xs font-semibold text-foreground mb-2">Fix Statistics</h3>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="p-2.5 rounded-md border border-border bg-background/50 text-center">
                          <p className="text-lg font-bold text-foreground">{setupProfile.fixes_attempted || 0}</p>
                          <p className="text-[10px] uppercase text-muted-foreground">Attempted</p>
                        </div>
                        <div className="p-2.5 rounded-md border border-border bg-background/50 text-center">
                          <p className="text-lg font-bold text-primary">{setupProfile.fixes_successful || 0}</p>
                          <p className="text-[10px] uppercase text-muted-foreground">Successful</p>
                        </div>
                        <div className="p-2.5 rounded-md border border-border bg-background/50 text-center">
                          <p className="text-lg font-bold text-chart-3">{setupProfile.fixes_failed || 0}</p>
                          <p className="text-[10px] uppercase text-muted-foreground">Failed</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <h3 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-muted-foreground" />
                      Active Plugins ({parsePlugins(selected.active_plugins).length})
                    </h3>
                    {(() => {
                      const plugins = parsePlugins(selected.active_plugins);
                      if (!plugins.length) return <p className="text-xs text-muted-foreground">No plugin data available for this domain.</p>;
                      return (
                        <div className="space-y-1 max-h-64 overflow-y-auto">
                          {plugins.map((p, i) => (
                            <div key={i} className="flex items-center justify-between px-2.5 py-1.5 rounded-md border border-border bg-background/50">
                              <span className="text-xs text-foreground truncate">{p.name}</span>
                              {p.version && <span className="text-[10px] font-mono text-muted-foreground shrink-0 ml-2">v{p.version}</span>}
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </>
              )}

              {detailTab === 'history' && (
                <div>
                  <h3 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-muted-foreground" />
                    Fix History ({fixes.length})
                  </h3>
                  {fixes.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No fixes applied yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {fixes.map(f => (
                        <div key={f.id} className="p-3 rounded-md border border-border bg-background/50">
                          <p className="text-xs font-medium text-foreground">{f.fix_description}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{f.fix_category}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${f.status === 'applied' ? 'bg-primary/10 text-primary' : 'bg-chart-3/10 text-chart-3'}`}>{f.status}</span>
                            <span className="text-[10px] text-muted-foreground ml-auto">{new Date(f.created_date).toLocaleDateString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
    >
      {children}
    </button>
  );
}

function FormField({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full bg-card border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50" />
    </div>
  );
}

function Detail({ label, value, icon: Icon }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">{label}</p>
      <div className="flex items-center gap-1">
        {Icon && <Icon className="w-3 h-3 text-muted-foreground" />}
        <p className="text-sm text-foreground capitalize">{value}</p>
      </div>
    </div>
  );
}