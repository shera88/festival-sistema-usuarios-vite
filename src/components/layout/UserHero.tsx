import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { X, Loader2, Pencil, FilePlus, UserPlus, UserRoundSearch } from 'lucide-react';
import type { User } from '@/types/domain';
import { webpProxy } from '@/lib/utils/img';

interface Props {
  user: User;
}

export function UserHero({ user }: Props) {
  const initial = (user.nombre_y_apellido || '?').charAt(0).toUpperCase();
  const rol = user.rol_primario
    ? user.rol_primario.charAt(0).toUpperCase() + user.rol_primario.slice(1)
    : 'Contacto';
  const inst = user.nombre_agrupacion || 'Sin institución';
  const puedeEditar = user.puede_editar ?? true; // kárdex participante = solo lectura
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // CTA contextual del header: solo en Inscripciones (→ Nueva Inscripción) y
  // Kardex (→ Nuevo Kardex). En las demás vistas NO aparece ningún botón arriba.
  // "Nuevo Kardex" solo para quienes gestionan (representante/director/coreógrafo
  // y staff de kárdex); los bailarines (solo lectura) no lo ven.
  const cta =
    pathname.startsWith('/inscripciones')
      ? { to: '/inscripcion', long: 'Nueva Inscripción', short: 'Inscribir', aria: 'Nueva inscripción', Icon: FilePlus }
      : pathname.startsWith('/kardex') && puedeEditar
        ? { to: '/kardex-form', long: 'Nuevo Kardex', short: 'Kardex', aria: 'Nuevo kardex', Icon: UserPlus }
        : null;

  return (
    <div
      className="flex items-center gap-4 border-b border-glass-border px-4 py-5 sm:px-8 sm:py-6"
      style={{ background: 'var(--bg-base)' }}
    >
      <button
        type="button"
        onClick={() => {
          if (user.imagen_contacto) {
            setPreviewLoaded(false);
            setPreviewOpen(true);
          }
        }}
        onMouseEnter={() => {
          if (user.imagen_contacto) {
            const hi = webpProxy(user.imagen_contacto, 450);
            if (hi) {
              const img = new Image();
              img.src = hi;
            }
          }
        }}
        disabled={!user.imagen_contacto}
        aria-label="Ver foto en grande"
        className="h-14 w-14 shrink-0 cursor-pointer overflow-hidden rounded-full transition hover:shadow-[0_0_18px_rgba(0,229,255,0.3)] disabled:cursor-default sm:h-16 sm:w-16"
        style={{ background: 'var(--bg-elevated)' }}
      >
        {user.imagen_contacto ? (
          <img
            src={webpProxy(user.imagen_contacto, 128) ?? user.imagen_contacto}
            alt={user.nombre_y_apellido}
            loading="lazy"
            decoding="async"
            draggable={false}
            className="h-full w-full object-cover"
            onError={(e) => {
              const target = e.currentTarget;
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent) {
                parent.innerHTML = `<div class="h-full w-full flex items-center justify-center text-white font-display font-bold text-2xl" style="background:var(--bg-card)">${initial}</div>`;
              }
            }}
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center font-display text-2xl font-bold text-text-white"
            style={{ background: 'var(--bg-card)' }}
          >
            {initial}
          </div>
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div
            className="truncate text-base font-light text-text-white sm:text-lg"
            style={{ letterSpacing: '-0.02em' }}
          >
            {user.nombre_y_apellido}
          </div>
          {puedeEditar && (
            <button
              type="button"
              onClick={() => navigate('/perfil')}
              aria-label="Editar perfil"
              title="Editar perfil"
              className="grid h-6 w-6 shrink-0 cursor-pointer place-items-center rounded-md text-text-45 transition hover:bg-white/5 hover:text-cyan"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          {/* Cambiar de usuario (supervisión) — SOLO super admin y SOLO en PC:
              en móvil queda el ícono del topbar. Abre el modal de AppHeader
              vía evento global (el modal vive allá). */}
          {user.es_super_admin && (
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('supervisar:open'))}
              aria-label="Cambiar de usuario (supervisión)"
              title="Cambiar de usuario (supervisión)"
              className="hidden h-6 w-6 shrink-0 cursor-pointer place-items-center rounded-md text-text-45 transition hover:bg-white/5 hover:text-gold sm:grid"
            >
              <UserRoundSearch className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div
          className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] uppercase text-text-65"
          style={{ letterSpacing: '0.6px' }}
        >
          <span
            className="rounded-md border border-glass-border bg-elev px-2 py-0.5 text-[9px] font-medium text-text-90"
            style={{ letterSpacing: '0.8px' }}
          >
            {rol}
          </span>
          <span className="text-text-45">•</span>
          <span className="truncate">{inst}</span>
        </div>
      </div>

      {cta && (
        <button
          type="button"
          onClick={() => navigate(cta.to)}
          aria-label={cta.aria}
          className="inline-flex shrink-0 items-center gap-2 rounded-full bg-primary-gradient px-4 py-2.5 text-[13px] font-bold text-white shadow-[0_10px_32px_-10px_rgba(168,85,247,0.55)] transition-transform duration-200 hover:scale-[1.03] active:scale-[0.97] sm:px-6 sm:py-3 sm:text-sm"
        >
          <cta.Icon className="h-4 w-4 shrink-0" />
          <span className="sm:hidden">{cta.short}</span>
          <span className="hidden sm:inline">{cta.long}</span>
        </button>
      )}

      {previewOpen && user.imagen_contacto &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-6 anim-fade-in"
            onClick={() => setPreviewOpen(false)}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setPreviewOpen(false);
              }}
              aria-label="Cerrar"
              className="absolute right-4 top-4 grid h-10 w-10 cursor-pointer place-items-center rounded-full border border-white/15 bg-black/55 text-white backdrop-blur-md transition hover:border-cyan hover:text-cyan"
            >
              <X className="h-5 w-5" />
            </button>
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative max-h-[80vh] max-w-full overflow-hidden rounded-2xl shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)]"
              style={{ background: 'var(--bg-elevated)' }}
            >
              {!previewLoaded && (
                <img
                  src={webpProxy(user.imagen_contacto, 128) ?? user.imagen_contacto}
                  alt=""
                  aria-hidden
                  draggable={false}
                  className="absolute inset-0 h-full w-full scale-110 object-cover blur-xl"
                />
              )}
              <img
                src={webpProxy(user.imagen_contacto, 450) ?? user.imagen_contacto}
                alt={user.nombre_y_apellido}
                draggable={false}
                fetchPriority="high"
                decoding="async"
                onLoad={() => setPreviewLoaded(true)}
                className={`relative block max-h-[80vh] max-w-full transition-opacity duration-200 ${
                  previewLoaded ? 'opacity-100' : 'opacity-0'
                }`}
              />
              {!previewLoaded && (
                <div className="absolute inset-0 grid place-items-center">
                  <Loader2 className="h-8 w-8 animate-spin text-cyan drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]" />
                </div>
              )}
            </div>
            <p
              className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-4 py-1.5 text-[12px] font-medium text-white backdrop-blur-md"
              style={{ letterSpacing: '0.3px' }}
            >
              {user.nombre_y_apellido}
            </p>
          </div>,
          document.body,
        )}
    </div>
  );
}
