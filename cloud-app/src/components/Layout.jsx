import { Outlet, Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  MessageSquare,
  History,
  CreditCard,
  Users,
  BookOpen,
  Download,
  Shield,
  ScrollText,
  Bell,
  FlaskConical,
} from 'lucide-react';
import Logo from '@/components/Logo';
import { APP_VERSION } from '@/lib/version';

const navSections = [
  {
    label: 'Plugin Console',
    items: [
      { label: 'AI Chat', path: '/chat', icon: MessageSquare },
      { label: 'Fix History', path: '/fix-history', icon: History },
      { label: 'Subscription', path: '/subscription', icon: CreditCard },
    ],
  },
  {
    label: 'Team Platform',
    items: [
      { label: 'Dashboard', path: '/', icon: LayoutDashboard },
      { label: 'Customers', path: '/customers', icon: Users },
      { label: 'Knowledge Base', path: '/knowledge-base', icon: BookOpen },
      { label: 'Plugin Download', path: '/plugin-download', icon: Download },
    ],
  },
  {
    label: 'Security & Ops',
    items: [
      { label: 'Vulnerability Scans', path: '/vulnerability-scans', icon: Shield },
      { label: 'Audit Log', path: '/audit-log', icon: ScrollText },
      { label: 'Notifications', path: '/notifications', icon: Bell },
      { label: 'Staged Fixes', path: '/staged-fixes', icon: FlaskConical },
    ],
  },
];

export default function Layout() {
  const location = useLocation();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="w-60 shrink-0 border-r border-border bg-card/30 flex flex-col">
        <div className="p-4 border-b border-border">
          <Logo compact />
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-6">
          {navSections.map((section) => (
            <div key={section.label}>
              <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-150 ${
                        isActive
                          ? 'bg-primary/10 text-primary border-l-2 border-primary'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border-l-2 border-transparent'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-border">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span>AI Engine Online · v{APP_VERSION}</span>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}