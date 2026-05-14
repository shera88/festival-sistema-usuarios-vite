import { useQueryClient } from '@tanstack/react-query';
import { Menu, RefreshCw, ChevronDown, LogOut, User } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AppSidebar } from './AppSidebar';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { webpProxy } from '@/lib/utils/img';
import logoUrl from '@/assets/logo-danzarte.png';

export function AppHeader() {
  const { user, logout } = useAuth();
  const qc = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [sidebar, setSidebar] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

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

  function handleLogoutClick() {
    setMenuOpen(false);
    setLogoutConfirmOpen(true);
  }

  async function handleLogoutConfirm() {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
      setLogoutConfirmOpen(false);
    }
  }

  const initial = (user?.nombre_y_apellido || '?').charAt(0).toUpperCase();

  return (
    <>
      <AppSidebar open={sidebar} onClose={() => setSidebar(false)} />

      <nav
        className="sticky top-0 z-50 flex items-center justify-between border-b border-glass-border px-4 py-3"
        style={{ background: 'var(--bg-base)' }}
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

          <button
            type="button"
            onClick={() => navigate('/inscripciones')}
            aria-label="Ir al inicio"
            className="flex items-center rounded-lg p-1 transition hover:bg-white/5"
          >
            <img
              src={logoUrl}
              alt="Festival Danzarte 2026"
              className="h-12 w-auto object-contain"
              draggable={false}
            />
          </button>
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
              className="mb-0.5 text-[9px] font-medium uppercase leading-none text-text-45"
              style={{ letterSpacing: '1.2px' }}
            >
              {user?.rol_primario}
            </p>
            <p className="text-[12px] font-light leading-none" style={{ letterSpacing: '-0.01em' }}>
              {user?.nombre_y_apellido}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Abrir menú de usuario"
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
                  src={webpProxy(user.imagen_contacto, 80) ?? user.imagen_contacto}
                  alt={user.nombre_y_apellido}
                  loading="lazy"
                  decoding="async"
                  draggable={false}
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
              className="absolute right-0 top-full z-[100] mt-2 w-64 overflow-hidden rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.6)]"
              style={{ background: 'var(--brand-elev)' }}
            >
              <div
                className="border-b border-white/[0.04] p-4"
                style={{ background: 'rgba(255,255,255,0.03)' }}
              >
                <p
                  className="mb-1 text-[9px] font-medium uppercase text-text-45"
                  style={{ letterSpacing: '1.2px' }}
                >
                  {user?.rol_primario}
                </p>
                <p className="truncate text-[13px] font-light text-white" style={{ letterSpacing: '-0.01em' }}>
                  {user?.nombre_y_apellido}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-text-45">
                  {user?.nombre_agrupacion}
                </p>
              </div>
              <div className="p-2">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    navigate('/perfil');
                  }}
                  className="group flex w-full items-center gap-3 rounded-xl px-4 py-3 text-[13px] font-medium text-text-90 transition hover:bg-white/5 hover:text-cyan"
                >
                  <User className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  <span>Ver mi perfil</span>
                </button>
                <button
                  type="button"
                  onClick={handleLogoutClick}
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

      <ConfirmDialog
        open={logoutConfirmOpen}
        variant="danger"
        title="¿Cerrar sesión?"
        message={<p>Saldrá de su cuenta y tendrá que volver a iniciar sesión para acceder a sus datos.</p>}
        confirmText="Cerrar sesión"
        cancelText="Cancelar"
        loading={loggingOut}
        onConfirm={handleLogoutConfirm}
        onClose={() => {
          if (!loggingOut) setLogoutConfirmOpen(false);
        }}
      />
    </>
  );
}
