import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw, LogOut } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import logoUrl from '@/assets/logo-danzarte.png';

export function AppHeader() {
  const { logout } = useAuth();
  const qc = useQueryClient();
  const [syncing, setSyncing] = useState(false);

  async function handleSync() {
    if (syncing) return;
    setSyncing(true);
    try {
      await qc.invalidateQueries();
    } finally {
      setTimeout(() => setSyncing(false), 1500);
    }
  }

  async function handleLogout() {
    if (confirm('¿Cerrar sesión?')) {
      await logout();
    }
  }

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-glass-border bg-base/80 backdrop-blur-md px-4 py-3">
      <img
        src={logoUrl}
        alt="Festival DanzArte 2026"
        className="h-10 w-auto"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSync}
          disabled={syncing}
          aria-label="Sincronizar"
          className="inline-flex items-center gap-1.5 rounded-lg border border-glass-border bg-glass-bg px-3 py-1.5 text-xs text-text-90 hover:border-cyan/40 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Sincronizar</span>
        </button>
        <button
          type="button"
          onClick={handleLogout}
          aria-label="Salir"
          className="inline-flex items-center gap-1.5 rounded-lg border border-glass-border bg-glass-bg px-3 py-1.5 text-xs text-text-90 hover:border-fuchsia/40"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Salir</span>
        </button>
      </div>
    </header>
  );
}
