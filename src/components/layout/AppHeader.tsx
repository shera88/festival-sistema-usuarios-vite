import { useQueryClient } from '@tanstack/react-query';
import { Menu, RefreshCw, ChevronDown, LogOut } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { AppSidebar } from './AppSidebar';
import logoUrl from '@/assets/logo-danzarte.png';

export function AppHeader() {
  const { user, logout } = useAuth();
  const qc = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [sidebar, setSidebar] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleSync() {
    if (syncing) return;
    setSyncing(true);
    try {
      await qc.invalidateQueries();
    } finally {
      setTimeout(() => setSyncing(false), 1200);
    }
  }

  async function handleLogout() {
    setMenuOpen(false);
    if (confirm('¿Cerrar sesión?')) {
      await logout();
    }
  }

  const initial = (user?.nombre_y_apellido || '?').charAt(0).toUpperCase();

  return (
    <>
      <AppSidebar open={sidebar} onClose={() => setSidebar(false)} />

      <nav
        className="sticky top-0 z-50 flex items-center justify-between border-b border-glass-border px-4 py-3 backdrop-blur-md"
        style={{ background: 'rgba(8, 5, 30, 0.85)' }}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSidebar(true)}
            aria-label="Abrir menú"
            className="rounded-xl border border-transparent p-2 transition hover:border-white/10 hover:bg-white/5"
          >
            <Menu className="h-6 w-6 text-white" />
          </button>

          <div className="flex items-center">
            <img
              src={logoUrl}
              alt="Festival DanzArte 2026"
              className="h-12 w-auto object-contain"
              style={{ filter: 'drop-shadow(0 0 12px rgba(0,229,255,0.18))' }}
            />
          </div>
        </div>

        <div ref={menuRef} className="relative flex items-center gap-3">
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            aria-label="Sincronizar"
            title="Sincronizar datos"
            className="rounded-xl border border-transparent p-2 text-text-45 transition hover:border-white/10 hover:bg-white/5 hover:text-cyan disabled:opacity-50"
          >
            <RefreshCw className={`h-5 w-5 ${syncing ? 'animate-spin' : ''}`} />
          </button>

          <div className="hidden text-right md:block">
            <p
              className="mb-0.5 text-[10px] font-bold uppercase leading-none text-text-45"
              style={{ letterSpacing: '1.5px' }}
            >
              {user?.rol_primario}
            </p>
            <p className="text-[13px] font-semibold leading-none">
              {user?.nombre_y_apellido}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="group flex items-center gap-2 rounded-full border border-transparent p-1 transition hover:border-white/10 hover:bg-white/5"
          >
            <div
              className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 transition"
              style={{
                borderColor: 'rgba(0,245,255,0.3)',
                background: 'var(--brand-card)',
              }}
            >
              {user?.imagen_contacto ? (
                <img
                  src={user.imagen_contacto}
                  alt={user.nombre_y_apellido}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    const t = e.currentTarget;
                    t.style.display = 'none';
                    const p = t.parentElement;
                    if (p) p.innerHTML = `<span class="font-bold" style="color:var(--brand-accent)">${initial}</span>`;
                  }}
                />
              ) : (
                <span className="font-bold" style={{ color: 'var(--brand-accent)' }}>
                  {initial}
                </span>
              )}
            </div>
            <ChevronDown
              className={`h-4 w-4 text-text-25 transition-transform ${menuOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 top-full z-[100] mt-2 w-64 overflow-hidden rounded-2xl border border-brand-border shadow-[0_10px_40px_rgba(0,0,0,0.5)]"
              style={{ background: 'var(--brand-elev)' }}
            >
              <div
                className="border-b border-brand-border p-4"
                style={{ background: 'rgba(255,255,255,0.04)' }}
              >
                <p
                  className="mb-1 text-[10px] font-bold uppercase text-text-45"
                  style={{ letterSpacing: '1.5px' }}
                >
                  {user?.rol_primario}
                </p>
                <p className="truncate text-[13px] font-bold text-white">
                  {user?.nombre_y_apellido}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-text-45">
                  {user?.nombre_agrupacion}
                </p>
              </div>
              <div className="p-2">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="group flex w-full items-center gap-3 rounded-xl px-4 py-3 text-[13px] font-medium text-red-400 transition hover:bg-red-500/10"
                >
                  <LogOut className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  <span>Cerrar Sesión</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </nav>
    </>
  );
}
