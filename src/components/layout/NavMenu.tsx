import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, FileText, Users, FilePlus, X, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const ITEMS = [
  {
    to: '/inscripcion',
    label: 'Inscripción',
    desc: 'Inscribir una obra al festival',
    icon: FilePlus,
    color: 'var(--cyan)',
  },
  {
    to: '/kardex-form',
    label: 'Kardex',
    desc: 'Registrar integrantes de tu agrupación',
    icon: Users,
    color: 'var(--fuchsia)',
  },
  {
    to: '/solicitud',
    label: 'Solicitud',
    desc: 'Solicitar participación',
    icon: FileText,
    color: 'var(--gold)',
  },
] as const;

const ADMIN_ITEMS = [
  {
    to: '/admin/pagos',
    label: 'Admin Pagos',
    desc: 'Dashboard de pagos del festival',
    icon: ShieldCheck,
    color: 'var(--green)',
  },
] as const;

type MenuItem = { to: string; label: string; desc: string; icon: typeof FilePlus; color: string };

export function NavMenu() {
  const { puedeEditar, user } = useAuth();
  const esAdmin = !!user?.es_admin;
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) {
      document.addEventListener('mousedown', onDoc);
      return () => document.removeEventListener('mousedown', onDoc);
    }
  }, [open]);

  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, []);

  // Bailarines/participantes (solo lectura, sin admin) no tienen menú.
  if (!puedeEditar && !esAdmin) return null;

  function renderItem(item: MenuItem) {
    const Icon = item.icon;
    return (
      <button
        key={item.to}
        type="button"
        onClick={() => {
          navigate(item.to);
          setOpen(false);
        }}
        className="flex w-full items-start gap-3 border-b border-glass-border px-4 py-3 text-left transition last:border-b-0 hover:bg-white/[0.04]"
      >
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border"
          style={{
            borderColor: `${item.color}33`,
            background: `${item.color}1a`,
            color: item.color,
          }}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-text-white">{item.label}</div>
          <div className="mt-0.5 text-[11px] text-text-45">{item.desc}</div>
        </div>
      </button>
    );
  }

  function sectionHeader(title: string) {
    return (
      <div className="border-b border-glass-border px-4 py-3">
        <div className="text-[10px] font-semibold uppercase text-text-45" style={{ letterSpacing: '1px' }}>
          {title}
        </div>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Menú"
        className="flex h-10 w-10 items-center justify-center rounded-full border border-glass-border text-text-65 transition hover:border-cyan hover:text-cyan"
        style={{ background: 'var(--bg-elevated)' }}
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {open && (
        <div
          className="absolute left-0 top-full mt-2 w-72 overflow-hidden rounded-xl border border-glass-border shadow-2xl anim-fade-in"
          style={{
            background: 'linear-gradient(180deg, var(--bg-elevated) 0%, var(--bg-card) 100%)',
            backdropFilter: 'blur(16px)',
          }}
        >
          {puedeEditar && (
            <>
              {sectionHeader('Formularios')}
              <div>{ITEMS.map(renderItem)}</div>
            </>
          )}
          {esAdmin && (
            <>
              {sectionHeader('Administración')}
              <div>{ADMIN_ITEMS.map(renderItem)}</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
