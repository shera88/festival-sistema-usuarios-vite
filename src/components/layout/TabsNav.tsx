import { NavLink } from 'react-router-dom';
import { ClipboardList, Users, Award, Video, CreditCard, ShieldCheck, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { pagosVisibleParaRol } from '@/lib/roles';

export function TabsNav() {
  const { puedeEditar, user } = useAuth();
  // Bailarines/participantes (solo lectura) ven etiquetas personales.
  const TABS: { to: string; label: string; color: string; icon: LucideIcon }[] = [
    { to: '/inscripciones', label: puedeEditar ? 'Inscripciones' : 'Mis Participaciones', color: 'var(--cyan)', icon: ClipboardList },
    { to: '/kardex', label: puedeEditar ? 'Kardex' : 'Mis Agrupaciones', color: 'var(--fuchsia)', icon: Users },
    { to: '/calificaciones', label: 'Calificaciones', color: 'var(--gold)', icon: Award },
    { to: '/videos', label: 'Videos', color: 'var(--purple)', icon: Video },
    // Pagos solo para representantes/directores/coreógrafos (staff). NO bailarines.
    ...(pagosVisibleParaRol(user)
      ? [{ to: '/pagos', label: 'Pagos', color: 'var(--green)', icon: CreditCard }]
      : []),
    // Solo admins de pagos (Yacu / Shera / Briza) ven el dashboard admin.
    ...(user?.es_admin
      ? [{ to: '/admin/pagos', label: 'Admin Pagos', color: 'var(--green)', icon: ShieldCheck }]
      : []),
  ];

  return (
    <nav
      className="sticky top-16 z-30 hidden overflow-x-auto border-b border-glass-border no-scrollbar lg:flex"
      style={{ background: 'var(--bg-base)' }}
    >
      {TABS.map((t) => {
        const Icon = t.icon;
        return (
          <NavLink
            key={t.to}
            to={t.to}
            className="group relative flex flex-none items-center justify-center gap-2 whitespace-nowrap border-r border-glass-border px-4 py-3.5 text-center text-[11px] font-semibold uppercase transition-all last:border-r-0 lg:flex-1 lg:min-w-29.5"
            style={({ isActive }) => ({
              letterSpacing: '0.6px',
              color: isActive ? t.color : 'var(--text-45)',
              // Fondo tintado con el color de identidad del tab cuando está activo →
              // cada sección se distingue de un vistazo (cian/fucsia/oro/púrpura/verde).
              background: isActive
                ? `color-mix(in srgb, ${t.color} 16%, transparent)`
                : 'transparent',
              borderBottom: `2.5px solid ${isActive ? t.color : 'transparent'}`,
            })}
          >
            {({ isActive }) => (
              <>
                {/* Barrita superior de color solo en el activo (refuerza identidad) */}
                {isActive && (
                  <span
                    aria-hidden
                    className="absolute inset-x-0 top-0 h-[2.5px]"
                    style={{ background: t.color }}
                  />
                )}
                <Icon
                  className="h-4.5 w-4.5 shrink-0 transition-opacity"
                  strokeWidth={2.4}
                  // El ícono siempre lleva el color propio del tab (aunque esté
                  // inactivo, semitransparente) para diferenciarlos entre sí.
                  style={{ color: t.color, opacity: isActive ? 1 : 0.72 }}
                />
                <span
                  className={
                    isActive
                      ? ''
                      : 'text-text-45 transition-colors group-hover:text-text-90'
                  }
                >
                  {t.label}
                </span>
              </>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}
