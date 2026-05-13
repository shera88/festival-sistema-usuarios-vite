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
      className="sticky top-[60px] z-10 flex overflow-x-auto border-b border-glass-border backdrop-blur-md no-scrollbar"
      style={{
        background:
          'linear-gradient(90deg, rgba(14,9,40,0.85) 0%, rgba(18,10,48,0.92) 100%)',
      }}
    >
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          className={({ isActive }) =>
            `relative flex-1 min-w-[110px] whitespace-nowrap px-3 py-3 text-center text-[10px] font-light uppercase transition-all duration-300 ${
              isActive ? '' : 'text-text-45 hover:bg-cyan/[0.05]'
            }`
          }
          style={({ isActive }) =>
            isActive
              ? {
                  color: t.color,
                  letterSpacing: '0.5px',
                  borderBottom: `3px solid ${t.color}`,
                  textShadow: `0 0 12px ${t.color}55`,
                }
              : {
                  letterSpacing: '0.5px',
                  borderBottom: '3px solid transparent',
                  ['--hover-color' as string]: t.color,
                }
          }
        >
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
