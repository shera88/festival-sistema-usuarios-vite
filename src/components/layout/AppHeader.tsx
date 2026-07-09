import { useQueryClient } from '@tanstack/react-query';
import { Menu, RefreshCw, ChevronDown, LogOut, User, Eye, X, Loader2, Search, UserRoundSearch } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { authApi } from '@/lib/api/auth';
import type { SearchResult } from '@/types/domain';
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
  const [supervisarOpen, setSupervisarOpen] = useState(false);
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

  // El ícono de supervisión del UserHero (PC, junto al lápiz del nombre) abre
  // el modal de acá vía este evento global.
  useEffect(() => {
    const open = () => setSupervisarOpen(true);
    window.addEventListener('supervisar:open', open);
    return () => window.removeEventListener('supervisar:open', open);
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

  async function handleVolverAMiCuenta() {
    try {
      await authApi.stopImpersonar();
    } finally {
      window.location.href = '/';
    }
  }

  return (
    <>
      <AppSidebar open={sidebar} onClose={() => setSidebar(false)} />

      {user?.impersonando && (
        <div
          className="sticky top-0 z-[60] flex items-center justify-center gap-3 border-b border-gold/40 px-4 py-1.5 text-[12px]"
          style={{ background: 'rgba(232,208,152,0.12)', color: 'var(--gold, #E8D098)' }}
        >
          <Eye className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            Supervisando a <strong>{user?.nombre_y_apellido}</strong>
            {user?.real_user_nombre ? <> — usted es {user.real_user_nombre}</> : null}
          </span>
          <button
            type="button"
            onClick={() => setSupervisarOpen(true)}
            className="shrink-0 rounded-md border border-gold/50 px-2 py-0.5 text-[11px] font-semibold uppercase transition hover:bg-gold/20"
          >
            Cambiar usuario
          </button>
          <button
            type="button"
            onClick={handleVolverAMiCuenta}
            className="shrink-0 rounded-md border border-gold/50 px-2 py-0.5 text-[11px] font-semibold uppercase transition hover:bg-gold/20"
          >
            Volver a mi cuenta
          </button>
        </div>
      )}

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

          {/* Móvil: cambiar de usuario desde el topbar. En PC el ícono está
              junto al lápiz del nombre (UserHero). */}
          {user?.es_super_admin && (
            <button
              type="button"
              onClick={() => setSupervisarOpen(true)}
              aria-label="Cambiar de usuario (supervisión)"
              title="Cambiar de usuario (supervisión)"
              className="rounded-xl border border-transparent p-2 text-text-45 transition hover:border-white/10 hover:bg-white/5 hover:text-gold sm:hidden"
            >
              <UserRoundSearch className="h-5 w-5" />
            </button>
          )}

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
                {user?.es_super_admin && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setSupervisarOpen(true);
                    }}
                    className="group flex w-full items-center gap-3 rounded-xl px-4 py-3 text-[13px] font-medium text-text-90 transition hover:bg-white/5 hover:text-gold"
                  >
                    <Eye className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    <span>Supervisar usuario</span>
                  </button>
                )}
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

      {supervisarOpen && <SupervisarModal onClose={() => setSupervisarOpen(false)} />}

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

/**
 * Modal de supervisión (solo super admin): busca a una persona (mismo buscador
 * del login) y entra a su panel. Al confirmar, impersonar.php cambia la sesión
 * al target y se recarga la app completa (todos los queries se rehacen como esa
 * persona). El banner dorado de arriba permite volver a la cuenta real.
 */
function SupervisarModal({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [entering, setEntering] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setResults([]);
      return;
    }
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      setSearching(true);
      try {
        setResults(await authApi.searchParticipants(query));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [q]);

  async function handleEnter(r: SearchResult) {
    setEntering(r.id_contacto);
    setError(null);
    try {
      await authApi.impersonar(r.id_contacto);
      window.location.href = '/';
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se pudo entrar al panel');
      setEntering(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center bg-black/70 p-4 pt-[12vh] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-2xl border border-glass-border shadow-[0_20px_60px_rgba(0,0,0,0.7)]"
        style={{ background: 'var(--brand-elev)' }}
      >
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-white">
            <Eye className="h-4 w-4 text-gold" />
            Supervisar usuario
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="grid h-7 w-7 place-items-center rounded-md text-text-45 transition hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4">
          <p className="mb-3 text-[12px] text-text-45">
            Elija a la persona: entrará a su panel y verá todo lo que esa persona ve.
          </p>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-45" />
            <input
              autoFocus
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Busque por nombre, carnet o teléfono..."
              className="w-full rounded-lg border border-glass-border bg-elev py-2.5 pl-10 pr-3 text-text-90 placeholder:text-text-45 focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
            />
          </div>

          {error && <p className="mt-2 text-[12px] text-red-400">{error}</p>}

          <div className="mt-3 max-h-72 overflow-y-auto">
            {searching && (
              <div className="flex items-center gap-2 px-2 py-3 text-[12px] text-text-45">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Buscando…
              </div>
            )}
            {!searching && q.trim().length >= 2 && results.length === 0 && (
              <p className="px-2 py-3 text-[12px] text-text-45">Sin resultados.</p>
            )}
            {results.map((r) => (
              <button
                key={r.id_contacto}
                type="button"
                disabled={!!entering}
                onClick={() => handleEnter(r)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/5 disabled:opacity-50"
              >
                {r.foto ? (
                  <img
                    src={webpProxy(r.foto, 64) ?? r.foto}
                    alt=""
                    className="h-9 w-9 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/5 text-[13px] font-bold text-gold">
                    {(r.nombre || '?').charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-text-90">{r.nombre}</span>
                  <span className="block truncate text-[11px] text-text-45">
                    {r.rol || ''}{r.nombre_agrupacion ? ` · ${r.nombre_agrupacion}` : ''}
                  </span>
                </span>
                {entering === r.id_contacto && (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-gold" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
