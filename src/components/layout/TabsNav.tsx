import { NavLink } from 'react-router-dom';

const TABS = [
  { to: '/inscripciones', label: 'Inscripciones' },
  { to: '/kardex', label: 'Kardex' },
  { to: '/calificaciones', label: 'Calificaciones' },
  { to: '/videos', label: 'Videos' },
  { to: '/pagos', label: 'Pagos' },
] as const;

export function TabsNav() {
  return (
    <nav className="sticky top-[60px] z-10 border-b border-glass-border bg-base/80 backdrop-blur-md">
      <div className="flex gap-1 overflow-x-auto px-2 py-2 no-scrollbar">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) =>
              `relative whitespace-nowrap rounded-lg px-4 py-2 text-sm transition ${
                isActive
                  ? 'text-text-90'
                  : 'text-text-45 hover:text-text-90 hover:bg-glass-bg'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span>{t.label}</span>
                {isActive && (
                  <span
                    className="absolute inset-x-2 bottom-0 h-[3px] rounded-full"
                    style={{ background: 'linear-gradient(90deg, var(--cyan), var(--fuchsia))' }}
                  />
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
