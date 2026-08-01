import { useQueryClient } from '@tanstack/react-query';
import { Menu, RefreshCw, ChevronDown, LogOut, User, Eye, X, Loader2, Search, UserRoundSearch } from 'lucide-react';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { authApi, type DirectorioPersona } from '@/lib/api/auth';
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
      window.location.href = import.meta.env.BASE_URL;
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

type CargoFiltro = 'TODOS' | 'REPRESENTANTE' | 'DIRECTOR' | 'COREOGRAFO';
type DiaFiltro = 'TODOS' | 'MARTES' | 'MIERCOLES' | 'JUEVES' | 'VIERNES' | 'SIN_DIA';

const CARGO_CHIPS: { value: CargoFiltro; label: string }[] = [
  { value: 'TODOS', label: 'Todos' },
  { value: 'REPRESENTANTE', label: 'Representantes' },
  { value: 'DIRECTOR', label: 'Directores' },
  { value: 'COREOGRAFO', label: 'Coreógrafos' },
];

const DIA_CHIPS: { value: DiaFiltro; label: string }[] = [
  { value: 'TODOS', label: 'Todos' },
  { value: 'MARTES', label: 'Martes' },
  { value: 'MIERCOLES', label: 'Miércoles' },
  { value: 'JUEVES', label: 'Jueves' },
  { value: 'VIERNES', label: 'Viernes' },
  { value: 'SIN_DIA', label: 'Sin día' },
];

const CARGO_BADGE_CLS: Record<string, string> = {
  REPRESENTANTE: 'border-cyan/40 bg-cyan/10 text-cyan',
  DIRECTOR: 'border-fuchsia/40 bg-fuchsia/10 text-fuchsia',
  COREOGRAFO: 'border-gold/40 bg-gold/10 text-gold',
};

const CARGO_LABEL: Record<string, string> = {
  REPRESENTANTE: 'Representante',
  DIRECTOR: 'Director',
  COREOGRAFO: 'Coreógrafo',
};

/** lowercase + sin acentos, para comparar/filtrar texto. */
function normTxt(s: string | null | undefined): string {
  return (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** MARTES → Martes, MIERCOLES → Miércoles, etc. */
function diaLabel(dia: string | null): string | null {
  const d = normTxt(dia).trim();
  if (!d) return null;
  const map: Record<string, string> = {
    martes: 'Martes',
    miercoles: 'Miércoles',
    jueves: 'Jueves',
    viernes: 'Viernes',
  };
  return map[d] ?? (dia ? dia.charAt(0).toUpperCase() + dia.slice(1).toLowerCase() : null);
}

function FiltroChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase transition ${
        active
          ? 'border-gold/60 bg-gold/15 text-gold'
          : 'border-glass-border bg-white/[0.04] text-text-45 hover:text-text-90'
      }`}
      style={{ letterSpacing: '0.4px' }}
    >
      {children}
    </button>
  );
}

/**
 * Modal de supervisión (solo super admin): busca a una persona (mismo buscador
 * del login) y entra a su panel. Al confirmar, impersonar.php cambia la sesión
 * al target y se recarga la app completa (todos los queries se rehacen como esa
 * persona). El banner dorado de arriba permite volver a la cuenta real.
 *
 * Debajo del buscador hay un DIRECTORIO de personas con rol (representantes /
 * directores / coreógrafos) con filtros por cargo y por día de presentación.
 * El texto del buscador también filtra el directorio (nombre, teléfono y
 * agrupación), además de disparar la búsqueda server-side de siempre.
 */
function SupervisarModal({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [entering, setEntering] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);
  const [directorio, setDirectorio] = useState<DirectorioPersona[] | null>(null);
  const [dirLoading, setDirLoading] = useState(true);
  const [cargoFiltro, setCargoFiltro] = useState<CargoFiltro>('TODOS');
  const [diaFiltro, setDiaFiltro] = useState<DiaFiltro>('TODOS');

  useEffect(() => {
    let alive = true;
    authApi
      .supervisarDirectorio()
      .then((list) => {
        if (alive) setDirectorio(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (alive) setDirectorio([]);
      })
      .finally(() => {
        if (alive) setDirLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

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

  const dirFiltrado = useMemo(() => {
    if (!directorio) return [];
    const query = normTxt(q.trim());
    return directorio.filter((p) => {
      if (cargoFiltro !== 'TODOS' && !p.cargos.includes(cargoFiltro)) return false;
      if (diaFiltro === 'SIN_DIA') {
        if (p.dia) return false;
      } else if (diaFiltro !== 'TODOS' && normTxt(p.dia) !== normTxt(diaFiltro)) {
        return false;
      }
      if (query) {
        const haystack = `${normTxt(p.nombre)} ${normTxt(p.telefono)} ${normTxt(p.agrupacion)}`;
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [directorio, cargoFiltro, diaFiltro, q]);

  async function handleEnter(idContacto: string) {
    setEntering(idContacto);
    setError(null);
    try {
      await authApi.impersonar(idContacto);
      window.location.assign(import.meta.env.BASE_URL);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se pudo entrar al panel');
      setEntering(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center bg-black/70 p-4 pt-[8vh] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[84vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-glass-border shadow-[0_20px_60px_rgba(0,0,0,0.7)]"
        style={{ background: 'var(--brand-elev)' }}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-4 py-3">
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

        <div className="flex min-h-0 flex-1 flex-col p-4">
          <p className="mb-3 shrink-0 text-[12px] text-text-45">
            Elija a la persona: entrará a su panel y verá todo lo que esa persona ve.
          </p>
          <div className="relative shrink-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-45" />
            <input
              autoFocus
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Busque por nombre, carnet, teléfono o agrupación..."
              className="w-full rounded-lg border border-glass-border bg-elev py-2.5 pl-10 pr-3 text-text-90 placeholder:text-text-45 focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
            />
          </div>

          {error && <p className="mt-2 shrink-0 text-[12px] text-red-400">{error}</p>}

          {/* Resultados server-side del buscador. Cuando se busca, es la ÚNICA
              lista (ocupa el alto disponible); el directorio se oculta. */}
          {q.trim().length >= 2 && (
            <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
              {searching && (
                <div className="flex items-center gap-2 px-2 py-3 text-[12px] text-text-45">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Buscando…
                </div>
              )}
              {!searching && results.length === 0 && (
                <p className="px-2 py-3 text-[12px] text-text-45">Sin resultados de búsqueda.</p>
              )}
              {results.map((r) => (
                <button
                  key={r.id_contacto}
                  type="button"
                  disabled={!!entering}
                  onClick={() => handleEnter(r.id_contacto)}
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
          )}

          {/* Directorio de personas con rol, con filtros por cargo y día.
              Solo visible cuando NO se está buscando: así hay UNA sola lista. */}
          {q.trim().length < 2 && (
          <div className="mt-3 flex min-h-0 flex-1 flex-col">
            <div
              className="mb-2 flex shrink-0 items-center justify-between text-[10px] font-semibold uppercase text-text-45"
              style={{ letterSpacing: '0.8px' }}
            >
              <span>Directorio</span>
              {directorio && <span>{dirFiltrado.length} de {directorio.length}</span>}
            </div>

            <div className="mb-1.5 flex shrink-0 flex-wrap gap-1.5">
              {CARGO_CHIPS.map((c) => (
                <FiltroChip
                  key={c.value}
                  active={cargoFiltro === c.value}
                  onClick={() => setCargoFiltro(c.value)}
                >
                  {c.label}
                </FiltroChip>
              ))}
            </div>
            <div className="mb-2 flex shrink-0 flex-wrap gap-1.5">
              {DIA_CHIPS.map((d) => (
                <FiltroChip
                  key={d.value}
                  active={diaFiltro === d.value}
                  onClick={() => setDiaFiltro(d.value)}
                >
                  {d.label}
                </FiltroChip>
              ))}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {dirLoading && (
                <div className="flex items-center gap-2 px-2 py-3 text-[12px] text-text-45">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando directorio…
                </div>
              )}
              {!dirLoading && dirFiltrado.length === 0 && (
                <p className="px-2 py-3 text-[12px] text-text-45">
                  No hay personas que coincidan con los filtros.
                </p>
              )}
              {dirFiltrado.map((p) => (
                <button
                  key={p.id_contacto}
                  type="button"
                  disabled={!!entering}
                  onClick={() => handleEnter(p.id_contacto)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-white/5 disabled:opacity-50"
                >
                  {p.foto ? (
                    <img
                      src={webpProxy(p.foto, 64) ?? p.foto}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-9 w-9 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/5 text-[13px] font-bold text-gold">
                      {(p.nombre || '?').charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="min-w-0 truncate text-[13px] text-text-90">{p.nombre}</span>
                      {diaLabel(p.dia) && (
                        <span
                          className="shrink-0 rounded-full border border-white/10 bg-white/5 px-1.5 py-px text-[9px] font-semibold uppercase text-text-65"
                          style={{ letterSpacing: '0.4px' }}
                        >
                          {diaLabel(p.dia)}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 flex min-w-0 items-center gap-1.5">
                      {p.cargos.map((c) => (
                        <span
                          key={c}
                          className={`inline-flex shrink-0 items-center rounded-full border px-1.5 py-px text-[8px] font-semibold uppercase ${CARGO_BADGE_CLS[c] ?? 'border-white/10 bg-white/5 text-text-65'}`}
                          style={{ letterSpacing: '0.4px' }}
                        >
                          {CARGO_LABEL[c] ?? c}
                        </span>
                      ))}
                      <span className="min-w-0 truncate text-[11px] text-text-45">
                        {p.agrupacion || 'Sin agrupación'}
                      </span>
                    </span>
                  </span>
                  {entering === p.id_contacto && (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-gold" />
                  )}
                </button>
              ))}
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
