import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, PlusCircle, LogOut } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { ConnectionIndicator } from './ConnectionIndicator';

export function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { icon: Home, label: 'Home', path: '/' },
    { icon: PlusCircle, label: 'Capture', path: '/capture' },
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-16 border-r border-border bg-card items-center py-4 gap-4">
        <div className="text-lg font-bold text-primary mb-4">C</div>
        {navItems.map(({ icon: Icon, label, path }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            title={label}
            className={`p-3 rounded-lg transition-colors ${
              location.pathname === path
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            }`}
          >
            <Icon size={20} />
          </button>
        ))}
        <div className="mt-auto flex flex-col items-center gap-3">
          <ConnectionIndicator />
          <button
            onClick={handleLogout}
            title="Logout"
            className="p-3 rounded-lg text-muted-foreground hover:text-destructive hover:bg-accent transition-colors"
          >
            <LogOut size={20} />
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 pb-16 md:pb-0">{children}</main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t border-border bg-card flex justify-around items-center h-14 z-50" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {navItems.map(({ icon: Icon, label, path }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className={`flex flex-col items-center gap-0.5 p-2 ${
              location.pathname === path ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <Icon size={20} />
            <span className="text-[10px]">{label}</span>
          </button>
        ))}
        <button
          onClick={handleLogout}
          className="flex flex-col items-center gap-0.5 p-2 text-muted-foreground"
        >
          <LogOut size={20} />
          <span className="text-[10px]">Logout</span>
        </button>
      </nav>
    </div>
  );
}
