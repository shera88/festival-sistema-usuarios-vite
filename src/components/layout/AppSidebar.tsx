import { NavLink } from 'react-router-dom';
import {
  ClipboardList,
  Users,
  Award,
  Video,
  CreditCard,
  FilePlus,
  FileText,
  Music,
  X,
} from 'lucide-react';
import logoUrl from '@/assets/logo-danzarte.png';

interface Props {
  open: boolean;
  onClose: () => void;
}

const SECTIONS = [
  {
    label: 'Mi Cuenta',
    items: [
      { to: '/inscripciones', label: 'Inscripciones', icon: ClipboardList, color: 'var(--cyan)' },
      { to: '/kardex', label: 'Kardex', icon: Users, color: 'var(--fuchsia)' },
      { to: '/calificaciones', label: 'Calificaciones', icon: Award, color: 'var(--gold)' },
      { to: '/videos', label: 'Videos', icon: Video, color: 'var(--purple)' },
      { to: '/pagos', label: 'Pagos', icon: CreditCard, color: 'var(--green)' },
    ],
  },
  {
    label: 'Formularios',
    items: [
      { to: '/inscripcion', label: 'Inscripción', icon: FilePlus, color: 'var(--cyan)' },
      { to: '/kardex-form', label: 'Kardex (form)', icon: Music, color: 'var(--fuchsia)' },
      { to: '/solicitud', label: 'Solicitud', icon: FileText, color: 'var(--gold)' },
    ],
  },
] as const;

export function AppSidebar({ open, onClose }: Props) {
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed left-0 top-0 z-[70] flex h-full w-64 flex-col border-r border-brand-border transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ background: 'var(--brand-sidebar)' }}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/5 p-5">
          <div className="flex items-center gap-2.5">
            <img src={logoUrl} alt="DanzArte" className="h-9 w-auto" />
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
          {SECTIONS.map((section) => (
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
                    className={({ isActive }) =>
                      `group flex items-center gap-3 border-b border-white/5 px-6 py-3.5 text-[13px] transition ${
                        isActive
                          ? 'bg-white/5 font-semibold text-cyan'
                          : 'text-text-65 hover:bg-white/5 hover:text-white'
                      }`
                    }
                  >
                    <Icon
                      className="h-4 w-4 shrink-0 transition group-hover:scale-110"
                      style={'color' in item ? { color: item.color as string } : undefined}
                    />
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
          XVIII Festival DanzArte 2026
        </div>
      </aside>
    </>
  );
}
