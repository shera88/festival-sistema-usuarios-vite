import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Film, Trophy, Crown, LogOut } from 'lucide-react';
import { useCliente } from '@/hooks/useCliente';
import logoUrl from '@/assets/logo-danzarte.png';

/**
 * Armazón del área de CLIENTES: cabecera + tres pestañas + contenido.
 *
 * Mucho más chico que el shell del portal (AppHeader + AppSidebar + TabsNav +
 * BottomNav + UserHero) porque aquí hay tres pantallas, no catorce: un menú
 * lateral para tres ítems es puro andamiaje. Se usan los mismos tokens de
 * diseño, así que se ve parte de la misma aplicación.
 */

const PESTANAS = [
  { to: '/clientes/videos', label: 'Videos', icono: Film, color: 'var(--purple)' },
  { to: '/clientes/nominados', label: 'Nominados', icono: Trophy, color: 'var(--gold)' },
  { to: '/clientes/ganadores', label: 'Ganadores', icono: Crown, color: 'var(--cyan)' },
];

export function ClienteShell() {
  const { cliente, logout } = useCliente();
  const navigate = useNavigate();

  if (!cliente) return null;   // ClienteGuard ya redirigió; esto es por las dudas

  const salir = async () => {
    await logout();
    navigate('/clientes/login', { replace: true });
  };

  const inicial = (cliente.nombre || '?').charAt(0).toUpperCase();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-glass-border bg-glass-bg backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-3 py-2.5">
          <img src={logoUrl} alt="Festival Danzarte 2026" className="h-9 w-auto shrink-0" />

          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-text-90">{cliente.nombre}</p>
            <p className="truncate text-[11px] text-text-45">{cliente.email}</p>
          </div>

          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,var(--cyan),var(--fuchsia))] text-[13px] font-semibold text-white">
            {inicial}
          </span>

          <button
            type="button"
            onClick={salir}
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-glass-border text-text-45 transition-colors hover:bg-white/5 hover:text-text-90"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>

        <nav className="mx-auto flex w-full max-w-5xl gap-1 px-3 pb-2">
          {PESTANAS.map((p) => (
            <NavLink
              key={p.to}
              to={p.to}
              className={({ isActive }) =>
                [
                  'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-semibold transition-colors',
                  isActive
                    ? 'bg-white/10 text-text-90'
                    : 'text-text-45 hover:bg-white/5 hover:text-text-70',
                ].join(' ')
              }
              style={({ isActive }) => (isActive ? { color: p.color } : undefined)}
            >
              <p.icono className="h-4 w-4" />
              {p.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="flex-1 px-3">
        <Outlet />
      </main>

      <footer className="border-t border-glass-border px-3 py-4 text-center text-[11px] text-text-45">
        XVIII Festival Danzarte 2026
      </footer>
    </div>
  );
}
