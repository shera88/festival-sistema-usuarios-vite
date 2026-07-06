import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, MessageCircle, Trash2, Pencil, BadgeCheck, X, Loader2, Music2, Video, Crown } from 'lucide-react';
import type { KardexRow as KRow } from '@/types/domain';
import { whatsappLink } from '@/lib/utils/whatsapp';
import { webpProxy } from '@/lib/utils/img';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { EditKardexDialog } from './EditKardexDialog';
import { LazyImage } from '@/components/shared/LazyImage';
import { kardexApi } from '@/lib/api/kardex';
import { PdfPreviewModal } from '@/components/PdfPreviewModal';
import { descargarArchivo } from '@/lib/utils/descargarArchivo';

/** URL determinística del PDF de credencial 2026 en Storage (uploads-2026/kardex-pdf). */
function credencialUrl2026(idKardex: string): string {
  const base = String(import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  return `${base}/storage/v1/object/public/uploads-2026/kardex-pdf/credencial-${idKardex}.pdf`;
}

interface Props {
  row: KRow;
  canDelete?: boolean;
  canEdit?: boolean;
  /** Año actual de festival (2026+) — controla si se ve switch verificado */
  isCurrentYear?: boolean;
  /** Si la agrupación está cerrada → switch visible pero read-only */
  locked?: boolean;
}

export function KardexRow({
  row,
  canDelete = false,
  canEdit = false,
  isCurrentYear = false,
  locked = false,
}: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [infoMsg, setInfoMsg] = useState<{ title: string; body: string } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHiResLoaded, setPreviewHiResLoaded] = useState(false);
  const [credPreviewOpen, setCredPreviewOpen] = useState(false);
  const debounceRef = useRef<{
    timer: number | null;
    serverValue: boolean;
    /** Valor que el user quiere mientras debounce está pendiente. null = sin pending */
    pendingValue: boolean | null;
    ci: string;
    nameNorm: string;
  }>({
    timer: null,
    serverValue: !!row.verificado,
    pendingValue: null,
    ci: '',
    nameNorm: '',
  });

  useEffect(() => {
    return () => {
      if (debounceRef.current.timer !== null) {
        window.clearTimeout(debounceRef.current.timer);
      }
    };
  }, []);

  // Protege optimistic mientras hay debounce pendiente: si una refetch del
  // server sobreescribe el cache local, re-aplica el valor que el user quiso.
  useEffect(() => {
    const ref = debounceRef.current;
    if (ref.pendingValue === null) return;
    if (!!row.verificado === ref.pendingValue) return;
    if (!row.id_kardex) return;
    patchCache(row.id_kardex, ref.ci, ref.nameNorm, ref.pendingValue);
  }, [row.verificado, row.id_kardex]);

  const nombre = row.nombre_y_apellido || 'Sin nombre';
  const initial = nombre.charAt(0).toUpperCase();
  const wa = whatsappLink(row.telefono);
  const fotoOpt = webpProxy(row.foto, 96);
  const hasIdKardex = !!row.id_kardex;

  async function handleDelete() {
    if (!row.id_kardex) return;
    setDeleting(true);
    setErrMsg(null);
    try {
      await kardexApi.eliminar(row.id_kardex);
      await qc.invalidateQueries({ queryKey: ['kardex'] });
      setConfirmOpen(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al eliminar';
      setErrMsg(msg);
    } finally {
      setDeleting(false);
    }
  }

  function normName(s: string | null | undefined): string {
    return (s ?? '')
      .trim()
      .replace(/\s+/g, ' ')
      .toUpperCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');
  }

  /**
   * Actualiza el flag verificado en cache TanStack.
   * Replica por CI + nombre normalizado: si misma persona en N agrupaciones
   * abiertas, las toca todas. Si CI duplicado con nombres distintos (data sucia)
   * solo toca el row clickeado.
   */
  function patchCache(
    targetId: string,
    ci: string,
    nameNorm: string,
    newValue: boolean,
  ) {
    qc.setQueriesData<Record<string, KRow[]>>({ queryKey: ['kardex'] }, (old) => {
      if (!old) return old;
      const next: Record<string, KRow[]> = {};
      for (const year of Object.keys(old)) {
        next[year] = old[year].map((r) => {
          if (r.id_kardex === targetId) return { ...r, verificado: newValue };
          if (
            ci &&
            String(r.ci ?? '').trim() === ci &&
            normName(r.nombre_y_apellido) === nameNorm
          ) {
            return { ...r, verificado: newValue };
          }
          return r;
        });
      }
      return next;
    });
  }

  /** Sync cache con ids_actualizados reales del servidor. */
  function patchCacheByIds(ids: string[], newValue: boolean) {
    const idSet = new Set(ids);
    qc.setQueriesData<Record<string, KRow[]>>({ queryKey: ['kardex'] }, (old) => {
      if (!old) return old;
      const next: Record<string, KRow[]> = {};
      for (const year of Object.keys(old)) {
        next[year] = old[year].map((r) =>
          r.id_kardex && idSet.has(r.id_kardex) ? { ...r, verificado: newValue } : r,
        );
      }
      return next;
    });
  }

  function handleToggleVerificado() {
    if (!row.id_kardex) return;
    const id = row.id_kardex;
    const next = !row.verificado;
    const ci = String(row.ci ?? '').trim();
    const nameNorm = normName(row.nombre_y_apellido);

    // Optimistic: replica por CI + nombre normalizado en cache local.
    patchCache(id, ci, nameNorm, next);

    const ref = debounceRef.current;
    ref.pendingValue = next; // user wants this; protege contra refetch
    ref.ci = ci;
    ref.nameNorm = nameNorm;
    if (ref.timer !== null) window.clearTimeout(ref.timer);

    // Debounce 5 segundos. Si user vuelve a clickear dentro de la ventana,
    // se cancela el envío al server y se acumula el último estado.
    ref.timer = window.setTimeout(() => {
      ref.timer = null;
      const all = qc.getQueriesData<Record<string, KRow[]>>({ queryKey: ['kardex'] });
      let current = next;
      outer: for (const [, data] of all) {
        if (!data) continue;
        for (const arr of Object.values(data)) {
          const r = arr.find((x) => x.id_kardex === id);
          if (r) {
            current = !!r.verificado;
            break outer;
          }
        }
      }
      if (current === ref.serverValue) {
        ref.pendingValue = null;
        return;
      }
      const sending = current;
      kardexApi
        .verificar(id, sending)
        .then((res) => {
          ref.serverValue = sending;
          ref.pendingValue = null;
          if (res?.ids_actualizados && res.ids_actualizados.length > 0) {
            patchCacheByIds(res.ids_actualizados, sending);
          }
        })
        .catch((e: unknown) => {
          ref.pendingValue = null;
          patchCache(id, ci, nameNorm, ref.serverValue);
          const msg = e instanceof Error ? e.message : 'Error al verificar';
          setInfoMsg({ title: 'Error al verificar', body: msg });
          setInfoOpen(true);
        });
    }, 5000);
  }

  const verified = !!row.verificado;

  return (
    <div
      className={`border-b border-glass-border transition last:border-b-0 ${
        verified
          ? 'bg-[rgba(16,185,129,0.06)] hover:bg-[rgba(16,185,129,0.09)]'
          : 'hover:bg-fuchsia/[0.02]'
      }`}
      style={verified ? { boxShadow: 'inset 3px 0 0 var(--green)' } : undefined}
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
        className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-3 text-left select-none sm:gap-3 sm:px-4"
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (row.foto) {
              setPreviewHiResLoaded(false);
              setPreviewOpen(true);
            }
          }}
          onMouseEnter={() => {
            // Prefetch hi-res al hover para que cuando se abra preview esté listo
            if (row.foto) {
              const hiRes = webpProxy(row.foto, 450);
              if (hiRes) {
                const img = new Image();
                img.src = hiRes;
              }
            }
          }}
          aria-label="Ver foto en grande"
          disabled={!row.foto}
          className={`relative h-12 w-12 shrink-0 cursor-pointer overflow-hidden rounded-full border-2 transition disabled:cursor-default ${
            verified ? 'border-green' : 'border-glass-border'
          } ${row.foto ? 'hover:ring-2 hover:ring-cyan/50' : ''}`}
          style={{ background: 'var(--bg-elevated)' }}
        >
          {fotoOpt ? (
            <LazyImage
              src={fotoOpt}
              alt={nombre}
              draggable={false}
              className="h-full w-full object-cover"
              fallback={
                <span
                  className="flex h-full w-full items-center justify-center font-display text-base font-bold text-fuchsia"
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(255,31,168,0.15) 0%, rgba(255,31,168,0.05) 100%)',
                  }}
                >
                  {initial}
                </span>
              }
            />
          ) : (
            <span
              className="flex h-full w-full items-center justify-center font-display text-base font-bold text-fuchsia"
              style={{
                background:
                  'linear-gradient(135deg, rgba(255,31,168,0.15) 0%, rgba(255,31,168,0.05) 100%)',
              }}
            >
              {initial}
            </span>
          )}
          {verified && (
            <span
              className="absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full border-2 text-white"
              style={{ background: 'var(--green)', borderColor: 'var(--bg-card)' }}
              aria-label="Verificado"
            >
              <BadgeCheck className="h-2.5 w-2.5" />
            </span>
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[13px] font-medium text-text-white">{nombre}</span>
            <MembresiaBadge row={row} />
          </div>
          <div
            className="mt-0.5 truncate text-[10px] uppercase text-text-45"
            style={{ letterSpacing: '0.4px' }}
          >
            {row.cargo || '—'}
          </div>
        </div>

        {wa && (
          <a
            href={wa}
            target="_blank"
            rel="noopener"
            aria-label="WhatsApp"
            onClick={(e) => e.stopPropagation()}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-glass-border text-text-65 transition hover:border-green hover:text-green"
          >
            <MessageCircle className="h-3.5 w-3.5" />
          </a>
        )}

        {isCurrentYear && hasIdKardex && (
          <button
            type="button"
            role="switch"
            aria-checked={verified}
            aria-disabled={locked || undefined}
            aria-label={verified ? 'Marcar como no verificado' : 'Marcar como verificado'}
            onClick={(e) => {
              e.stopPropagation();
              if (locked) {
                setInfoMsg({
                  title: 'Agrupación cerrada',
                  body: 'Esta agrupación ya está marcada como completa. Contacte al administrador para habilitar cambios.',
                });
                setInfoOpen(true);
                return;
              }
              handleToggleVerificado();
            }}
            className={`relative h-[18px] w-8 shrink-0 rounded-full border transition ${
              locked ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'
            }`}
            style={{
              background: verified ? 'var(--green)' : 'rgba(255,255,255,0.08)',
              borderColor: verified ? 'var(--green)' : 'var(--glass-border)',
            }}
          >
            <span
              className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-white shadow transition-all"
              style={{ left: verified ? 'calc(100% - 14px)' : '2px' }}
            />
          </button>
        )}

        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform duration-300 ${
            open ? 'rotate-180 text-fuchsia' : 'text-text-45'
          }`}
        />
      </div>

      {open && (
        <div className="border-t border-glass-border bg-black/20 anim-fade-in">
          {/* Acciones secundarias */}
          {(canEdit || canDelete) && (
            <div className="flex flex-wrap items-center gap-1.5 border-b border-glass-border px-3 py-2.5 sm:px-4">
              {canEdit && hasIdKardex && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditOpen(true);
                  }}
                  className="flex items-center gap-1.5 rounded-md border border-glass-border bg-glass-bg px-2 py-1.5 text-[10px] font-semibold uppercase text-text-65 transition hover:border-cyan/60 hover:text-cyan"
                  style={{ letterSpacing: '0.5px' }}
                >
                  <Pencil className="h-3 w-3" />
                  Editar
                </button>
              )}
              {canDelete && hasIdKardex && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmOpen(true);
                  }}
                  className="flex items-center gap-1.5 rounded-md border border-glass-border bg-glass-bg px-2 py-1.5 text-[10px] font-semibold uppercase text-text-65 transition hover:border-red-400/60 hover:text-red-400"
                  style={{ letterSpacing: '0.5px' }}
                >
                  <Trash2 className="h-3 w-3" />
                  Eliminar
                </button>
              )}
            </div>
          )}

          {/* Detalles */}
          <div className="space-y-1.5 px-4 py-3 text-[11px]">
            <Detail label="Teléfono" value={row.telefono} />
            <Detail label="Correo" value={row.correo_electronico} />
            <Detail label="CI" value={row.ci} />
            <Detail label="Ciudad" value={row.ciudad} />
            <Detail label="Edad" value={row.edad} />
            <Detail label="Estado" value={row.estado} />

            {/* Bailes en los que participa (obras de su agrupación) */}
            {Array.isArray(row.bailes) && row.bailes.length > 0 && (
              <div className="pt-1.5">
                <span
                  className="text-[9px] uppercase text-text-45"
                  style={{ letterSpacing: '0.5px' }}
                >
                  Baila en
                </span>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {row.bailes.map((b) => (
                    <span
                      key={b.id_inscripcion}
                      className="inline-flex items-center gap-1 rounded-full border border-fuchsia/40 bg-fuchsia/10 px-2 py-0.5 text-[10px] font-medium text-fuchsia"
                    >
                      <Music2 className="h-2.5 w-2.5" />
                      {b.nombre_de_la_obra}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {isCurrentYear && hasIdKardex ? (
              // Año actual (2026): credencial real desde Storage (preview + descarga);
              // certificado aún no disponible → mensaje.
              <div className="mt-2 flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCredPreviewOpen(true);
                  }}
                  className="rounded-md border border-cyan/40 bg-cyan/10 px-2.5 py-1 text-[11px] font-medium text-cyan transition hover:bg-cyan/20"
                >
                  Credencial
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setInfoMsg({
                      title: 'Certificado',
                      body: 'Los certificados se entregarán al finalizar el festival.',
                    });
                    setInfoOpen(true);
                  }}
                  className="rounded-md border border-fuchsia/40 bg-fuchsia/10 px-2.5 py-1 text-[11px] font-medium text-fuchsia transition hover:bg-fuchsia/20"
                >
                  Certificado
                </button>
              </div>
            ) : (row.enlace_del_credencial || row.enlace_del_certificado) ? (
              // Años pasados: enlaces históricos (Google Doc / PDF) tal cual.
              <div className="mt-2 flex flex-wrap gap-2 pt-1">
                {row.enlace_del_credencial && (
                  <a
                    href={row.enlace_del_credencial}
                    target="_blank"
                    rel="noopener"
                    className="rounded-md border border-cyan/40 bg-cyan/10 px-2.5 py-1 text-[11px] font-medium text-cyan transition hover:bg-cyan/20"
                  >
                    Credencial
                  </a>
                )}
                {row.enlace_del_certificado && (
                  <a
                    href={row.enlace_del_certificado}
                    target="_blank"
                    rel="noopener"
                    className="rounded-md border border-fuchsia/40 bg-fuchsia/10 px-2.5 py-1 text-[11px] font-medium text-fuchsia transition hover:bg-fuchsia/20"
                  >
                    Certificado
                  </a>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        variant="danger"
        title="¿Eliminar a este integrante?"
        message={
          <>
            <p>
              Se eliminará a <strong className="text-text-white">{nombre}</strong> del kardex 2026.
            </p>
            <p className="mt-2 text-text-45">Esta acción no se puede deshacer.</p>
            {errMsg && <p className="mt-2 text-[12px] text-red-400">{errMsg}</p>}
          </>
        }
        confirmText="Eliminar"
        cancelText="Cancelar"
        loading={deleting}
        onConfirm={handleDelete}
        onClose={() => {
          if (!deleting) {
            setConfirmOpen(false);
            setErrMsg(null);
          }
        }}
      />

      <EditKardexDialog open={editOpen} row={row} onClose={() => setEditOpen(false)} />

      {credPreviewOpen && row.id_kardex && (
        <PdfPreviewModal
          url={credencialUrl2026(row.id_kardex)}
          title={`Credencial — ${nombre}`}
          openUrl={credencialUrl2026(row.id_kardex)}
          actionLabel="Descargar credencial"
          onAction={() => {
            void descargarArchivo(credencialUrl2026(row.id_kardex!), `Credencial - ${nombre}.pdf`, 'Credencial');
          }}
          onClose={() => setCredPreviewOpen(false)}
        />
      )}

      {previewOpen && row.foto &&
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
              {/* Low-res placeholder ya cacheado (96px del avatar) */}
              {!previewHiResLoaded && fotoOpt && (
                <img
                  src={fotoOpt}
                  alt=""
                  aria-hidden
                  draggable={false}
                  className="absolute inset-0 h-full w-full object-cover blur-xl scale-110"
                />
              )}
              {/* Hi-res 600px que se carga progresivamente */}
              <img
                src={webpProxy(row.foto, 450) ?? row.foto}
                alt={nombre}
                draggable={false}
                fetchPriority="high"
                decoding="async"
                onLoad={() => setPreviewHiResLoaded(true)}
                className={`relative block max-h-[80vh] max-w-full transition-opacity duration-200 ${
                  previewHiResLoaded ? 'opacity-100' : 'opacity-0'
                }`}
              />
              {/* Spinner mientras carga la hi-res */}
              {!previewHiResLoaded && (
                <div className="absolute inset-0 grid place-items-center">
                  <Loader2 className="h-8 w-8 animate-spin text-cyan drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]" />
                </div>
              )}
            </div>
            <p
              className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-4 py-1.5 text-[12px] font-medium text-white backdrop-blur-md"
              style={{ letterSpacing: '0.3px' }}
            >
              {nombre}
            </p>
          </div>,
          document.body,
        )}

      <ConfirmDialog
        open={infoOpen}
        variant="info"
        hideCancel
        title={infoMsg?.title ?? ''}
        message={<p>{infoMsg?.body ?? ''}</p>}
        onClose={() => setInfoOpen(false)}
      />
    </div>
  );
}

/**
 * Etiqueta de membresía junto al nombre. Distingue Paquete Completo (superset)
 * de la de Videos, y pagada (sólida) de sólo reservada (contorno + "reserva").
 * El Paquete tiene prioridad si por algún motivo tuviera ambas.
 */
function MembresiaBadge({ row }: { row: KRow }) {
  const paquetePago = !!row.membresia_paquete_pagada;
  const videosPago = !!row.membresia_pagada;
  const paqueteRes = !!row.membresia_paquete && !paquetePago;
  const videosRes = !!row.membresia && !videosPago && !paquetePago && !paqueteRes;

  let cfg: { text: string; cls: string; Icon: typeof Video } | null = null;
  if (paquetePago) {
    cfg = { text: 'Paquete', Icon: Crown, cls: 'border-[rgba(168,85,247,0.7)] bg-[rgba(168,85,247,0.18)] text-[rgb(216,180,254)]' };
  } else if (videosPago) {
    cfg = { text: 'Videos', Icon: Video, cls: 'border-cyan/60 bg-cyan/15 text-cyan' };
  } else if (paqueteRes) {
    cfg = { text: 'Paquete · reserva', Icon: Crown, cls: 'border-[rgba(168,85,247,0.4)] bg-transparent text-[rgba(216,180,254,0.75)]' };
  } else if (videosRes) {
    cfg = { text: 'Videos · reserva', Icon: Video, cls: 'border-cyan/35 bg-transparent text-cyan/70' };
  }
  if (!cfg) return null;

  const { text, cls, Icon } = cfg;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-px text-[9px] font-semibold uppercase leading-tight ${cls}`}
      style={{ letterSpacing: '0.3px' }}
      title={`Membresía: ${text}`}
    >
      <Icon className="h-2.5 w-2.5" />
      {text}
    </span>
  );
}

function Detail({ label, value }: { label: string; value: string | number | null }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span
        className="text-[9px] uppercase text-text-45"
        style={{ letterSpacing: '0.5px' }}
      >
        {label}
      </span>
      <span className="truncate text-text-white">{value}</span>
    </div>
  );
}
