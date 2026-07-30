import { useState, useEffect } from 'react';
import { Bell, Plus, Trash2, Power, Send, Slack, MessageCircle, Mail, Webhook, X, Check } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const channelIcons = { slack: Slack, discord: MessageCircle, email: Mail, webhook: Webhook };

const eventTypes = [
  { value: 'fix_applied', label: 'Fix Applied' },
  { value: 'fix_reverted', label: 'Fix Reverted' },
  { value: 'verification_passed', label: 'Verification Passed' },
  { value: 'verification_failed', label: 'Verification Failed' },
  { value: 'vulnerability_found', label: 'Vulnerability Found' },
  { value: 'audit_change', label: 'Audit Change' },
];

export default function Notifications() {
  const [channels, setChannels] = useState([]);
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ domain_name: '', channel_type: 'slack', webhook_url: '', channel_name: '', events: ['fix_applied', 'verification_failed'] });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ch, doms] = await Promise.all([
        base44.entities.NotificationChannel.list('-created_date', 100),
        base44.entities.Domain.list('-created_date', 100),
      ]);
      setChannels(ch);
      setDomains(doms);
      if (doms.length > 0 && !form.domain_name) setForm(f => ({ ...f, domain_name: doms[0].domain_name }));
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const createChannel = async () => {
    setSaving(true);
    try {
      await base44.entities.NotificationChannel.create({
        ...form,
        events: JSON.stringify(form.events),
        is_active: true,
      });
      setShowForm(false);
      setForm({ domain_name: domains[0]?.domain_name || '', channel_type: 'slack', webhook_url: '', channel_name: '', events: ['fix_applied', 'verification_failed'] });
      await fetchData();
    } catch (e) { console.error(e); } finally { setSaving(false); }
  };

  const toggleChannel = async (channel) => {
    await base44.entities.NotificationChannel.update(channel.id, { is_active: !channel.is_active });
    await fetchData();
  };

  const deleteChannel = async (channelId) => {
    await base44.entities.NotificationChannel.delete(channelId);
    await fetchData();
  };

  const testChannel = async (channelId) => {
    setTesting(channelId);
    try {
      await base44.functions.invoke('sendNotification', { action: 'test', channel_id: channelId });
    } catch (e) { console.error(e); } finally { setTesting(null); }
  };

  const toggleEvent = (eventValue) => {
    setForm(f => ({
      ...f,
      events: f.events.includes(eventValue) ? f.events.filter(e => e !== eventValue) : [...f.events, eventValue],
    }));
  };

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <Bell className="w-6 h-6 text-primary" /> Notifications
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Configure Slack, Discord, email, and webhook alerts for fix events</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90">
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? 'Cancel' : 'Add Channel'}
        </button>
      </div>

      {showForm && (
        <div className="glass-card p-4 mb-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Domain</label>
              <select value={form.domain_name} onChange={(e) => setForm(f => ({ ...f, domain_name: e.target.value }))} className="w-full bg-card border border-border rounded-md px-3 py-2 text-sm text-foreground">
                {domains.map(d => <option key={d.id} value={d.domain_name}>{d.domain_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Channel Type</label>
              <select value={form.channel_type} onChange={(e) => setForm(f => ({ ...f, channel_type: e.target.value }))} className="w-full bg-card border border-border rounded-md px-3 py-2 text-sm text-foreground">
                <option value="slack">Slack</option>
                <option value="discord">Discord</option>
                <option value="email">Email</option>
                <option value="webhook">Generic Webhook</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">
              {form.channel_type === 'email' ? 'Email Address' : 'Webhook URL'}
            </label>
            <input value={form.webhook_url} onChange={(e) => setForm(f => ({ ...f, webhook_url: e.target.value }))} placeholder={form.channel_type === 'email' ? 'alerts@example.com' : 'https://hooks.slack.com/services/...'} className="w-full bg-card border border-border rounded-md px-3 py-2 text-sm text-foreground" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Channel Name</label>
            <input value={form.channel_name} onChange={(e) => setForm(f => ({ ...f, channel_name: e.target.value }))} placeholder="Dev Team Alerts" className="w-full bg-card border border-border rounded-md px-3 py-2 text-sm text-foreground" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 block">Events to Subscribe</label>
            <div className="grid grid-cols-2 gap-2">
              {eventTypes.map(evt => (
                <button key={evt.value} onClick={() => toggleEvent(evt.value)} className={`flex items-center gap-2 px-3 py-2 rounded-md border text-xs font-medium transition-colors ${form.events.includes(evt.value) ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted'}`}>
                  {form.events.includes(evt.value) ? <Check className="w-3.5 h-3.5" /> : <div className="w-3.5 h-3.5" />}
                  {evt.label}
                </button>
              ))}
            </div>
          </div>
          <button onClick={createChannel} disabled={saving || !form.webhook_url} className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50">
            {saving ? 'Saving...' : 'Create Channel'}
          </button>
        </div>
      )}

      <div className="space-y-3">
        {loading ? (
          <div className="text-center text-sm text-muted-foreground py-12">Loading channels...</div>
        ) : channels.length === 0 ? (
          <div className="glass-card px-4 py-12 text-center">
            <Bell className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No notification channels yet. Click "Add Channel" to get started.</p>
          </div>
        ) : (
          channels.map((channel) => {
            const Icon = channelIcons[channel.channel_type] || Webhook;
            let events = [];
            try { events = JSON.parse(channel.events || '[]'); } catch {}
            return (
              <div key={channel.id} className="glass-card p-4 flex items-center gap-4">
                <div className={`w-10 h-10 rounded-md flex items-center justify-center ${channel.is_active ? 'bg-primary/10' : 'bg-muted'}`}>
                  <Icon className={`w-5 h-5 ${channel.is_active ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{channel.channel_name || `${channel.channel_type} channel`}</p>
                  <p className="text-xs text-muted-foreground truncate">{channel.domain_name} · {channel.webhook_url.substring(0, 60)}{channel.webhook_url.length > 60 ? '...' : ''}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {events.map(e => <span key={e} className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{e.replace(/_/g, ' ')}</span>)}
                  </div>
                </div>
                <button onClick={() => testChannel(channel.id)} disabled={testing === channel.id} className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground" title="Send test notification">
                  {testing === channel.id ? <div className="w-4 h-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
                <button onClick={() => toggleChannel(channel)} className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground" title={channel.is_active ? 'Deactivate' : 'Activate'}>
                  <Power className={`w-4 h-4 ${channel.is_active ? 'text-primary' : ''}`} />
                </button>
                <button onClick={() => deleteChannel(channel.id)} className="p-2 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="Delete">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}