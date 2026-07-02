import { NavLink } from 'react-router-dom';
import { FilePlus, FileText, IdCard, X, ClipboardList, Users, Award, Video, CreditCard, ShieldCheck, type LucideIcon } from 'lucide-react';
import logoUrl from '@/assets/logo-danzarte.png';
import { useAuth } from '@/hooks/useAuth';
import { pagosVisibleParaRol } from '@/lib/roles';

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
        { to: '/inscripciones', label: puedeEditar ? 'Inscripciones' : 'Mis Participaciones', icon: ClipboardList },
        { to: '/kardex', label: puedeEditar ? 'Kardex' : 'Mis Agrupaciones', icon: Users },
        { to: '/calificaciones', label: 'Calificaciones', icon: Award },
        { to: '/videos', label: 'Videos', icon: Video },
        // Pagos solo para representantes/directores/coreógrafos (staff). NO bailarines.
        ...(pagosVisibleParaRol(user) ? [{ to: '/pagos', label: 'Pagos', icon: CreditCard }] : []),
        // Solo admins de pagos (Yacu / Shera / Briza).
        ...(user?.es_admin ? [{ to: '/admin/pagos', label: 'Admin Pagos', icon: ShieldCheck }] : []),
      ],
    },
    ...(puedeEditar ? [{ label: 'Formularios', items: FORM_ITEMS }] : []),
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
