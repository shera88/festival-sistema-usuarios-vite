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
    <header
      className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-glass-border px-4 backdrop-blur-md sm:px-6"
      style={{
        background:
          'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-card) 100%)',
      }}
    >
      <div className="flex h-full items-center">
        <img
          src={logoUrl}
          alt="Festival DanzArte 2026"
          className="h-12 w-auto object-contain"
          style={{ filter: 'drop-shadow(0 0 12px rgba(0, 229, 255, 0.15))' }}
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSync}
          disabled={syncing}
          aria-label="Sincronizar"
          className="inline-flex items-center gap-1.5 rounded-full border border-glass-border px-3 py-2 text-[11px] font-light uppercase text-text-65 transition hover:border-cyan hover:text-cyan disabled:opacity-50"
          style={{ background: 'var(--bg-elevated)', letterSpacing: '0.5px' }}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Sincronizar</span>
        </button>
        <button
          type="button"
          onClick={handleLogout}
          aria-label="Salir"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-glass-border text-text-65 transition hover:border-red-500 hover:text-red-500 sm:h-auto sm:w-auto sm:rounded-full sm:px-3 sm:py-2 sm:text-[11px] sm:font-light sm:uppercase"
          style={{ background: 'var(--bg-elevated)' }}
        >
          <LogOut className="h-4 w-4" />
          <span className="ml-1.5 hidden sm:inline" style={{ letterSpacing: '0.5px' }}>
            Salir
          </span>
        </button>
      </div>
    </header>
  );
}
