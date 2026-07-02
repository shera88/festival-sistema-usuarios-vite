import { NavLink } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { pagosVisibleParaRol } from '@/lib/roles';

export function TabsNav() {
  const { puedeEditar, user } = useAuth();
  // Bailarines/participantes (solo lectura) ven etiquetas personales.
  const TABS = [
    { to: '/inscripciones', label: puedeEditar ? 'Inscripciones' : 'Mis Participaciones', color: 'var(--cyan)' },
    { to: '/kardex', label: puedeEditar ? 'Kardex' : 'Mis Agrupaciones', color: 'var(--fuchsia)' },
    { to: '/calificaciones', label: 'Calificaciones', color: 'var(--gold)' },
    { to: '/videos', label: 'Videos', color: 'var(--purple)' },
    // Pagos solo para representantes/directores/coreógrafos (staff). NO bailarines.
    ...(pagosVisibleParaRol(user)
      ? [{ to: '/pagos', label: 'Pagos', color: 'var(--green)' }]
      : []),
    // Solo admins de pagos (Yacu / Shera / Briza) ven el dashboard admin.
    ...(user?.es_admin
      ? [{ to: '/admin/pagos', label: 'Admin Pagos', color: 'var(--green)' }]
      : []),
  ];

  return (
    <nav
      className="sticky top-16 z-30 hidden overflow-x-auto border-b border-glass-border no-scrollbar lg:flex"
      style={{ background: 'var(--bg-base)' }}
    >
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          className={({ isActive }) =>
            `relative flex-none whitespace-nowrap px-4 py-4 text-center text-[11px] font-semibold uppercase transition-colors lg:flex-1 lg:min-w-[110px] ${
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
