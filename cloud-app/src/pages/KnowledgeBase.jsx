import { useState, useEffect } from 'react';
import { BookOpen, Plus, Check, AlertTriangle, Code2, Settings, FileText, Database, Wrench, X, TrendingUp } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const categoryIcons = { css: Code2, settings: Settings, content: FileText, database: Database, other: Wrench };

export default function KnowledgeBase() {
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [newRecipe, setNewRecipe] = useState({ title: '', description: '', category: 'css', fix_template: '', wp_version_range: '', plugin_name: '', tags: '' });

  useEffect(() => { fetchRecipes(); }, []);

  const fetchRecipes = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.FixRecipe.list('-created_date', 200);
      setRecipes(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleCreate = async () => {
    if (!newRecipe.title.trim()) return;
    try {
      await base44.entities.FixRecipe.create({ ...newRecipe, status: 'draft', success_count: 0, total_count: 0 });
      setShowCreate(false);
      setNewRecipe({ title: '', description: '', category: 'css', fix_template: '', wp_version_range: '', plugin_name: '', tags: '' });
      await fetchRecipes();
    } catch (e) { console.error(e); }
  };

  const updateStatus = async (id, status) => {
    try {
      await base44.entities.FixRecipe.update(id, { status });
      await fetchRecipes();
    } catch (e) { console.error(e); }
  };

  const filtered = recipes.filter(r => {
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    if (filterCategory !== 'all' && r.category !== filterCategory) return false;
    return true;
  });

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Fix Knowledge Base</h1>
          <p className="text-sm text-muted-foreground mt-1">Vetted fix recipes the AI references when solving similar issues</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90">
          <Plus className="w-4 h-4" /> New Recipe
        </button>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="bg-card border border-border rounded-md px-3 py-1.5 text-sm text-foreground">
          <option value="all">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="verified">Verified</option>
          <option value="deprecated">Deprecated</option>
        </select>
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="bg-card border border-border rounded-md px-3 py-1.5 text-sm text-foreground">
          <option value="all">All Categories</option>
          <option value="css">CSS</option>
          <option value="settings">Settings</option>
          <option value="content">Content</option>
          <option value="database">Database</option>
          <option value="other">Other</option>
        </select>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} recipes</span>
      </div>

      {loading ? (
        <div className="text-center py-12 text-sm text-muted-foreground">Loading recipes...</div>
      ) : filtered.length === 0 ? (
        <div className="glass-card py-12 text-center">
          <BookOpen className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No recipes yet. Create one or let the AI auto-generate from successful fixes.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {filtered.map((r) => {
            const Icon = categoryIcons[r.category] || Wrench;
            const successRate = r.total_count > 0 ? Math.round((r.success_count / r.total_count) * 100) : 0;
            return (
              <div key={r.id} className="glass-card p-4">
                <div className="flex items-start gap-3 mb-2">
                  <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-foreground">{r.title}</h3>
                    <p className="text-xs text-muted-foreground line-clamp-2">{r.description}</p>
                  </div>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${
                    r.status === 'verified' ? 'bg-primary/10 text-primary' :
                    r.status === 'deprecated' ? 'bg-chart-3/10 text-chart-3' :
                    'bg-muted text-muted-foreground'
                  }`}>{r.status}</span>
                </div>

                <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                  {r.plugin_name && <span>{r.plugin_name}</span>}
                  {r.wp_version_range && <span>WP {r.wp_version_range}</span>}
                  {r.total_count > 0 && (
                    <span className="flex items-center gap-1 ml-auto">
                      <TrendingUp className="w-3 h-3" />
                      {successRate}% success ({r.total_count})
                    </span>
                  )}
                </div>

                {r.status !== 'verified' && (
                  <button onClick={() => updateStatus(r.id, 'verified')} className="mt-3 flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-primary/30 text-primary text-xs font-medium hover:bg-primary/10">
                    <Check className="w-3 h-3" /> Verify
                  </button>
                )}
                {r.status === 'verified' && (
                  <button onClick={() => updateStatus(r.id, 'deprecated')} className="mt-3 flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-chart-3/30 text-chart-3 text-xs font-medium hover:bg-chart-3/10">
                    <AlertTriangle className="w-3 h-3" /> Deprecate
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create dialog */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowCreate(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative w-full max-w-lg bg-card border border-border rounded-lg p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-foreground">New Fix Recipe</h2>
              <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <Field label="Title" value={newRecipe.title} onChange={v => setNewRecipe({...newRecipe, title: v})} placeholder="e.g. Center hero image on mobile" />
              <Field label="Description" value={newRecipe.description} onChange={v => setNewRecipe({...newRecipe, description: v})} placeholder="What this fix does" />
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Category</label>
                <select value={newRecipe.category} onChange={e => setNewRecipe({...newRecipe, category: e.target.value})} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground">
                  <option value="css">CSS</option>
                  <option value="settings">Settings</option>
                  <option value="content">Content</option>
                  <option value="database">Database</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <Field label="Fix Template (JSON)" value={newRecipe.fix_template} onChange={v => setNewRecipe({...newRecipe, fix_template: v})} placeholder='{"change_type":"css_inject","target":"...","value":"..."}' textarea />
              <Field label="WP Version Range" value={newRecipe.wp_version_range} onChange={v => setNewRecipe({...newRecipe, wp_version_range: v})} placeholder="e.g. 5.8+" />
              <Field label="Plugin Name" value={newRecipe.plugin_name} onChange={v => setNewRecipe({...newRecipe, plugin_name: v})} placeholder="e.g. Elementor" />
              <Field label="Tags" value={newRecipe.tags} onChange={v => setNewRecipe({...newRecipe, tags: v})} placeholder="comma, separated, tags" />
              <button onClick={handleCreate} className="w-full py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90">
                Create Recipe
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, textarea }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
      {textarea ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={3} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 font-mono" />
      ) : (
        <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50" />
      )}
    </div>
  );
}