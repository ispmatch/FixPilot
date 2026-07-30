export default function StatCard({ icon: Icon, label, value, sublabel, accent = 'primary' }) {
  const accentColors = {
    primary: 'text-primary bg-primary/10',
    secondary: 'text-chart-2 bg-chart-2/10',
    warning: 'text-chart-4 bg-chart-4/10',
    destructive: 'text-chart-3 bg-chart-3/10',
  };
  const colorClass = accentColors[accent] || accentColors.primary;

  return (
    <div className="glass-card p-5 transition-all duration-200 hover:border-border/80">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg ${colorClass} flex items-center justify-center`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="space-y-0.5">
        <p className="text-2xl font-bold text-foreground tracking-tight">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
        {sublabel && <p className="text-xs text-muted-foreground/70">{sublabel}</p>}
      </div>
    </div>
  );
}