import { NavLink } from 'react-router-dom';
import { ClipboardList, Users, Award, CalendarClock, Video, CreditCard, Trophy, Crown, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { pagosVisibleParaRol, inscripcionesVisibleParaRol, kardexVisibleParaRol } from '@/lib/roles';

// Barra de navegación inferior estilo app móvil (solo teléfono; en desktop se usan los tabs de arriba).
export function BottomNav() {
  const { user } = useAuth();

  const items: { to: string; label: string; icon: LucideIcon; color: string }[] = [
    // Inscripciones solo para el staff de la agrupación. NO bailarines.
    ...(inscripcionesVisibleParaRol(user)
      ? [{ to: '/inscripciones', label: 'Inscrip.', icon: ClipboardList, color: 'var(--cyan)' }]
      : []),
    // Kárdex solo para el staff de la agrupación. NO bailarines.
    ...(kardexVisibleParaRol(user)
      ? [{ to: '/kardex', label: 'Kárdex', icon: Users, color: 'var(--fuchsia)' }]
      : []),
    { to: '/calificaciones', label: 'Notas', icon: Award, color: 'var(--gold)' },
    { to: '/programa', label: 'Prog.', icon: CalendarClock, color: 'var(--purple)' },
    { to: '/videos', label: 'Videos', icon: Video, color: 'var(--purple)' },
    // Pagos solo para representantes/directores/coreógrafos (staff). NO bailarines.
    ...(pagosVisibleParaRol(user) ? [{ to: '/pagos', label: 'Pagos', icon: CreditCard, color: 'var(--green)' }] : []),
    // Nominados: visible para todo el portal, a diferencia de Admin Pagos —que
    // a propósito no está acá—. No adelanta ningún resultado (ver nominados.php).
    { to: '/nominados', label: 'Nomin.', icon: Trophy, color: 'var(--gold)' },
    // Ganadores: los resultados REALES, con lugar y nota. SOLO super admin —
    // lo contrario de Nominados, que es publico justamente porque los esconde.
    ...(user?.es_super_admin
      ? [{ to: '/ganadores', label: 'Ganad.', icon: Crown, color: 'var(--gold)' }]
      : []),
  ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-glass-border lg:hidden"
      style={{ background: 'var(--bg-base)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <NavLink
            key={it.to}
            to={it.to}
            end
            className="flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[9px] font-semibold uppercase tracking-wide transition-colors"
            style={({ isActive }) => ({ color: isActive ? it.color : 'var(--text-45)' })}
          >
            {({ isActive }) => (
              <>
                <Icon className="h-5 w-5" strokeWidth={isActive ? 2.4 : 2} />
                <span className="max-w-full truncate px-0.5 leading-none">{it.label}</span>
              </>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}
