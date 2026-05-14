import { NavLink } from 'react-router-dom';

const TABS = [
  { to: '/inscripciones', label: 'Inscripciones', color: 'var(--cyan)' },
  { to: '/kardex', label: 'Kardex', color: 'var(--fuchsia)' },
  { to: '/calificaciones', label: 'Calificaciones', color: 'var(--gold)' },
  { to: '/videos', label: 'Videos', color: 'var(--purple)' },
  { to: '/pagos', label: 'Pagos', color: 'var(--green)' },
] as const;

export function TabsNav() {
  return (
    <nav
      className="sticky top-16 z-30 flex overflow-x-auto border-b border-glass-border no-scrollbar"
      style={{ background: 'var(--bg-base)' }}
    >
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          className={({ isActive }) =>
            `relative flex-1 min-w-[110px] whitespace-nowrap px-4 py-4 text-center text-[11px] font-semibold uppercase transition-colors ${
              isActive ? 'text-text-white' : 'text-text-45 hover:text-text-90'
            }`
          }
          style={({ isActive }) =>
            isActive
              ? {
                  color: t.color,
                  letterSpacing: '0.8px',
                  borderBottom: `2px solid ${t.color}`,
                }
              : {
                  letterSpacing: '0.8px',
                  borderBottom: '2px solid transparent',
                }
          }
        >
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
