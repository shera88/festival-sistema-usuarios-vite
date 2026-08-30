import { NavLink } from 'react-router-dom';
import { FilePlus, FileText, IdCard, X, ClipboardList, Users, Award, CalendarClock, Video, CreditCard, ShieldCheck, Trophy, Crown, type LucideIcon } from 'lucide-react';
import logoUrl from '@/assets/logo-danzarte.png';
import { useAuth } from '@/hooks/useAuth';
import { pagosVisibleParaRol, inscripcionesVisibleParaRol, kardexVisibleParaRol, kardexGestionParaRol } from '@/lib/roles';
import { INSCRIPCION_ABIERTA } from '@/lib/flags';

interface Props {
  open: boolean;
  onClose: () => void;
}

// Prefetch dinámico de los chunks lazy al hacer hover sobre el NavLink.
// Esto carga el chunk en background ANTES del click → navegación instantánea.
const PREFETCH: Record<string, () => Promise<unknown>> = {
  '/inscripcion': () => import('@/routes/InscripcionPage'),
  '/kardex-form': () => import('@/routes/KardexFormPage'),
  '/solicitud': () => import('@/routes/SolicitudPage'),
};

const FORM_ITEMS = [
  { to: '/inscripcion', label: 'Inscripción', icon: FilePlus },
  { to: '/kardex-form', label: 'Kardex', icon: IdCard },
  { to: '/solicitud', label: 'Solicitud', icon: FileText },
];

type NavSection = { label: string; items: { to: string; label: string; icon: LucideIcon }[] };

export function AppSidebar({ open, onClose }: Props) {
  const { puedeEditar, user } = useAuth();

  // Secciones (los mismos tabs) + Formularios solo para quien puede editar.
  const sections: NavSection[] = [
    {
      label: 'Secciones',
      items: [
        // Inscripciones solo para el staff de la agrupación. NO bailarines.
        ...(inscripcionesVisibleParaRol(user)
          ? [{ to: '/inscripciones', label: 'Inscripciones', icon: ClipboardList }]
          : []),
        // Kárdex solo para el staff de la agrupación. NO bailarines.
        ...(kardexVisibleParaRol(user) ? [{ to: '/kardex', label: 'Kardex', icon: Users }] : []),
        { to: '/calificaciones', label: 'Calificaciones', icon: Award },
        { to: '/programa', label: 'Programa', icon: CalendarClock },
        { to: '/videos', label: 'Videos', icon: Video },
        // Pagos solo para representantes/directores/coreógrafos (staff). NO bailarines.
        ...(pagosVisibleParaRol(user) ? [{ to: '/pagos', label: 'Pagos', icon: CreditCard }] : []),
        // Solo admins de pagos (Yacu / Shera / Briza).
        ...(user?.es_admin ? [{ to: '/admin/pagos', label: 'Admin Pagos', icon: ShieldCheck }] : []),
        // Nominados: visible para todo el portal. Sin lugar ni nota y mezclado
        // en el servidor, no adelanta ningun resultado (ver nominados.php).
        { to: '/nominados', label: 'Nominados', icon: Trophy },
        // Ganadores: los resultados REALES, con lugar y nota. SOLO super admin —
        // lo contrario de Nominados, que es publico justamente porque los esconde.
        ...(user?.es_super_admin ? [{ to: '/ganadores', label: 'Ganadores', icon: Crown }] : []),
      ],
    },
    // Formularios: además del permiso de edición, el de Kárdex se filtra por rol
    // —el bailarín no lo tiene— para no ofrecerle un enlace que va a rebotar.
    ...(puedeEditar
      ? [{
          label: 'Formularios',
          items: FORM_ITEMS.filter(
            (i) =>
              (INSCRIPCION_ABIERTA || i.to !== '/inscripcion') &&
              // El formulario de kárdex es de gestión: el bailarín ve la lista
              // pero no da de alta a nadie.
              (i.to !== '/kardex-form' || kardexGestionParaRol(user)),
          ),
        }]
      : []),
  ];

  function prefetch(to: string) {
    PREFETCH[to]?.();
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm transition-opacity duration-150"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed left-0 top-0 z-[70] flex h-full w-64 flex-col border-r border-brand-border transition-transform duration-150 ease-out will-change-transform ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ background: 'var(--brand-sidebar)' }}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/5 p-5">
          <div className="flex items-center gap-2.5">
            <img src={logoUrl} alt="Danzarte" className="h-9 w-auto" />
            <span className="font-bold text-lg">Menú</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar menú"
            className="rounded-full p-2 text-text-45 transition hover:bg-white/5 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3">
          {sections.map((section) => (
            <div key={section.label} className="mb-2">
              <div
                className="px-6 pb-2 pt-3 text-[10px] font-bold uppercase text-text-45"
                style={{ letterSpacing: '1.2px' }}
              >
                {section.label}
              </div>
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end
                    onClick={onClose}
                    onMouseEnter={() => prefetch(item.to)}
                    onFocus={() => prefetch(item.to)}
                    className={({ isActive }) =>
                      `group flex items-center gap-3 border-b border-white/5 px-6 py-3.5 text-[13px] transition-colors ${
                        isActive
                          ? 'bg-white/5 font-semibold text-cyan'
                          : 'text-text-65 hover:bg-white/5 hover:text-white'
                      }`
                    }
                  >
                    <Icon className="h-4 w-4 shrink-0 text-white transition-transform group-hover:scale-110" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        <div
          className="border-t border-white/5 p-4 text-center text-[10px] text-text-25"
          style={{ letterSpacing: '0.5px' }}
        >
          XVIII Festival Danzarte 2026
        </div>
      </aside>
    </>
  );
}
