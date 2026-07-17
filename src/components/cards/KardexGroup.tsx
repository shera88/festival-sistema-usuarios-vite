import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Lock } from 'lucide-react';
import type { KardexRow as KRow, Year } from '@/types/domain';
import { KardexObraGroups } from './KardexObraGroups';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { kardexApi } from '@/lib/api/kardex';
import { webpProxy } from '@/lib/utils/img';
import { useAuth } from '@/hooks/useAuth';
import type { AgrupacionMeta } from '@/routes/tabs/KardexTab';

interface Props {
  year: Year;
  agrupacion: string;
  logo: string | null;
  rows: KRow[];
  meta: AgrupacionMeta | null;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function gradientFor(name: string): string {
  const palette = [
    'linear-gradient(135deg, #00E5FF, #7C3AED)',
    'linear-gradient(135deg, #FF1FA8, #7C3AED)',
    'linear-gradient(135deg, #E8D098, #FF1FA8)',
    'linear-gradient(135deg, #10B981, #00E5FF)',
    'linear-gradient(135deg, #7C3AED, #FF1FA8)',
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return palette[Math.abs(h) % palette.length];
}

export function KardexGroup({ year, agrupacion, logo, rows, meta }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(true);
  const [logoFailed, setLogoFailed] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loadingClose, setLoadingClose] = useState(false);
  const [confirmReopenOpen, setConfirmReopenOpen] = useState(false);
  const [loadingReopen, setLoadingReopen] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [infoMsg, setInfoMsg] = useState<{ title: string; body: string } | null>(null);

  const initials = initialsOf(agrupacion);
  const showImg = !!logo && !logoFailed;

  const { puedeEditar, user } = useAuth();
  // El super admin hace todo: edita/rota/verifica/elimina en cualquier
  // agrupación, incluso si está cerrada (el backend aplica el mismo bypass).
  const isSuperAdmin = !!user?.es_super_admin;
  // canManage: representante/coreógrafo/director y staff de kárdex (puede_editar).
  // Los logins de kárdex BAILARIN (puede_editar=false) son solo lectura.
  const canManage = puedeEditar || isSuperAdmin;
  const cerrada = (meta?.estado_credenciales ?? '').toLowerCase() === 'completo';
  const isCurrentYear = year === '2026';
  const canEdit = isCurrentYear && ((puedeEditar && !cerrada) || isSuperAdmin);
  const canClose = canManage && isCurrentYear && !cerrada && !!meta?.id_agrupacion;
  const canReopen = canManage && isCurrentYear && cerrada && !!meta?.id_agrupacion;

  const sortedRows = useMemo(
    () =>
      [...rows].sort((a, b) =>
        (a.nombre_y_apellido || '').localeCompare(b.nombre_y_apellido || ''),
      ),
    [rows],
  );

  const verificadosCount = useMemo(
    () => rows.filter((r) => r.verificado).length,
    [rows],
  );
  const todosVerificados = rows.length > 0 && verificadosCount === rows.length;
  const pendientes = rows.length - verificadosCount;

  async function handleCerrar() {
    if (!meta?.id_agrupacion) return;
    setLoadingClose(true);
    setErrMsg(null);
    try {
      await kardexApi.cerrarAgrupacion(meta.id_agrupacion);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['inscripciones'] }),
        qc.invalidateQueries({ queryKey: ['kardex'] }),
      ]);
      setConfirmOpen(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al cerrar agrupación';
      setErrMsg(msg);
    } finally {
      setLoadingClose(false);
    }
  }

  async function handleReabrir() {
    if (!meta?.id_agrupacion) return;
    setLoadingReopen(true);
    setErrMsg(null);
    try {
      await kardexApi.cerrarAgrupacion(meta.id_agrupacion, 'incompleto');
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['inscripciones'] }),
        qc.invalidateQueries({ queryKey: ['kardex'] }),
      ]);
      setConfirmReopenOpen(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al reabrir agrupación';
      setErrMsg(msg);
    } finally {
      setLoadingReopen(false);
    }
  }

  return (
    <article
      className={`overflow-hidden rounded-xl border transition anim-fade-in-up ${
        open
          ? 'border-white/10'
          : 'border-white/10 hover:border-text-25'
      }`}
      style={{
        // Navy elevado sólido (no se camufla con el fondo base).
        background: 'linear-gradient(135deg, var(--bg-card-h) 0%, var(--bg-card) 100%)',
        boxShadow: '0 8px 24px -14px rgba(0,0,0,0.6)',
      }}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
        className="flex w-full cursor-pointer items-center gap-3 p-4 text-left transition select-none"
        style={{
          background: open
            ? 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-card) 100%)'
            : 'transparent',
          borderBottom: open ? '1px solid var(--border)' : 'none',
        }}
      >
        <div
          className="h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 border-fuchsia"
          style={{
            background: showImg ? 'var(--bg-elevated)' : gradientFor(agrupacion),
            boxShadow: '0 0 16px rgba(255,31,168,0.15)',
          }}
        >
          {showImg ? (
            <img
              src={webpProxy(logo, 96) ?? logo!}
              alt={agrupacion}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
              onError={() => setLogoFailed(true)}
            />
          ) : (
            <span
              className="flex h-full w-full items-center justify-center font-display text-sm font-semibold"
              style={{ color: '#0E0928', letterSpacing: '0.5px' }}
            >
              {initials}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div
            className="truncate text-[14px] font-semibold uppercase text-text-white"
            style={{ letterSpacing: '0.5px' }}
          >
            {agrupacion}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-text-45">
            <span>{rows.length} integrante{rows.length !== 1 ? 's' : ''}</span>
            {cerrada && (
              <span className="ml-1 inline-flex items-center gap-1 rounded-md border border-cyan/40 bg-cyan/10 px-1.5 py-px text-[9px] font-semibold uppercase text-cyan" style={{ letterSpacing: '0.5px' }}>
                <Lock className="h-2.5 w-2.5" />
                Completa
              </span>
            )}
          </div>
        </div>

        {canManage && (canClose || cerrada) && isCurrentYear && (
          <button
            type="button"
            role="switch"
            aria-checked={cerrada}
            aria-label={cerrada ? 'Reabrir agrupación' : 'Marcar agrupación completa'}
            onClick={(e) => {
              e.stopPropagation();
              if (cerrada) {
                if (canReopen) {
                  setConfirmReopenOpen(true);
                  return;
                }
                setInfoMsg({
                  title: 'Agrupación cerrada',
                  body: 'Esta agrupación ya está marcada como completa. Contacte al administrador para habilitar cambios.',
                });
                setInfoOpen(true);
                return;
              }
              if (!todosVerificados) {
                setInfoMsg({
                  title: `Faltan ${pendientes} integrante${pendientes > 1 ? 's' : ''} por verificar`,
                  body: 'Active el switch de cada integrante para confirmar que sus datos son correctos antes de cerrar la agrupación.',
                });
                setInfoOpen(true);
                return;
              }
              setConfirmOpen(true);
            }}
            title={cerrada ? 'Reabrir agrupación' : 'Marcar agrupación completa'}
            className="relative h-[20px] w-9 shrink-0 cursor-pointer rounded-full border transition"
            style={{
              background: cerrada ? 'var(--cyan)' : 'rgba(255,255,255,0.08)',
              borderColor: cerrada ? 'var(--cyan)' : 'var(--glass-border)',
            }}
          >
            <span
              className="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-white shadow transition-all"
              style={{ left: cerrada ? 'calc(100% - 16px)' : '2px' }}
            />
          </button>
        )}

        <ChevronDown
          className={`h-5 w-5 shrink-0 transition-transform duration-300 ${
            open ? 'rotate-180 text-fuchsia' : 'text-text-45'
          }`}
        />
      </div>

      {open && (
        <div className="border-t border-white/10 anim-fade-in">
          <KardexObraGroups
            rows={sortedRows}
            canEdit={canEdit}
            canManage={canManage}
            isCurrentYear={isCurrentYear}
            locked={cerrada && !isSuperAdmin}
          />
        </div>
      )}

      <ConfirmDialog
        open={infoOpen}
        variant="info"
        hideCancel
        title={infoMsg?.title ?? ''}
        message={<p>{infoMsg?.body ?? ''}</p>}
        onClose={() => setInfoOpen(false)}
      />

      <ConfirmDialog
        open={confirmReopenOpen}
        variant="primary"
        title="¿Reabrir la agrupación?"
        message={
          <>
            <p>Podrá volver a agregar o editar integrantes.</p>
            <p className="mt-2 text-text-45">
              Cuando termine los cambios, vuelva a marcar la agrupación como completa.
            </p>
            {errMsg && <p className="mt-2 text-[12px] text-red-400">{errMsg}</p>}
          </>
        }
        confirmText="Sí, reabrir"
        cancelText="Cancelar"
        loading={loadingReopen}
        onConfirm={handleReabrir}
        onClose={() => {
          if (!loadingReopen) {
            setConfirmReopenOpen(false);
            setErrMsg(null);
          }
        }}
      />

      <ConfirmDialog
        open={confirmOpen}
        variant="primary"
        title="¿Marcar agrupación como completa?"
        message={
          <>
            <p>¿Está seguro que ya están todos sus bailarines y personal?</p>
            <p className="mt-2 text-text-45">
              <strong className="text-text-65">Una vez confirmado, la agrupación quedará bloqueada</strong> y no podrá añadir ni eliminar personas hasta que el administrador habilite los cambios.
            </p>
            <p className="mt-2 font-mono text-cyan">
              {verificadosCount}/{rows.length} integrantes verificados
            </p>
            {errMsg && <p className="mt-2 text-[12px] text-red-400">{errMsg}</p>}
          </>
        }
        confirmText="Sí, está completa"
        cancelText="Cancelar"
        loading={loadingClose}
        onConfirm={handleCerrar}
        onClose={() => {
          if (!loadingClose) {
            setConfirmOpen(false);
            setErrMsg(null);
          }
        }}
      />
    </article>
  );
}
