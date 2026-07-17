import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, MessageCircle, Trash2, Pencil, BadgeCheck, X, Loader2, Music2, Video, Crown, RotateCcw, RotateCw, Camera } from 'lucide-react';
import type { KardexRow as KRow } from '@/types/domain';
import { whatsappLink } from '@/lib/utils/whatsapp';
import { webpProxy } from '@/lib/utils/img';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { EditKardexDialog } from './EditKardexDialog';
import { BailesMultiselect, type BaileSel } from '@/components/kardex/BailesMultiselect';
import { LazyImage } from '@/components/shared/LazyImage';
import { kardexApi } from '@/lib/api/kardex';
import { useAuth } from '@/hooks/useAuth';
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
  /** Rol de gestión (puede_editar / super admin). Sin él (bailarines) NO se ve
   *  el switch de verificar ni editar/eliminar: solo los detalles. */
  canManage?: boolean;
  /** Año actual de festival (2026+) — controla si se ve switch verificado */
  isCurrentYear?: boolean;
  /** Si la agrupación está cerrada → switch visible pero read-only */
  locked?: boolean;
}

export function KardexRow({
  row,
  canDelete = false,
  canEdit = false,
  canManage = false,
  isCurrentYear = false,
  locked = false,
}: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const ownFotoInputRef = useRef<HTMLInputElement | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [infoMsg, setInfoMsg] = useState<{ title: string; body: string } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHiResLoaded, setPreviewHiResLoaded] = useState(false);
  const [credPreviewOpen, setCredPreviewOpen] = useState(false);
  const [regenerandoCred, setRegenerandoCred] = useState(false);
  // Rotación de foto (giro efímero previsualizado por CSS; se persiste al Guardar).
  const [rot, setRot] = useState(0);
  const [savingRot, setSavingRot] = useState(false);
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
  const canRotar = canEdit && !locked && hasIdKardex && !!row.foto;

  // Fila PROPIA de un usuario solo-lectura (bailarín): puede cambiar SU foto de
  // perfil (único control visible para él). Match por CI = carnet, solo dígitos.
  const soloDigitos = (s: unknown) => String(s ?? '').replace(/\D/g, '');
  const ciUser = soloDigitos(user?.numero_de_carnet);
  const isOwnRow = ciUser !== '' && soloDigitos(row.ci) === ciUser;
  const canOwnFoto = !canManage && isOwnRow && isCurrentYear && hasIdKardex && !locked;

  async function handleOwnFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (ownFotoInputRef.current) ownFotoInputRef.current.value = '';
    if (!file || !row.id_kardex) return;
    if (file.size > 5 * 1024 * 1024) {
      setInfoMsg({ title: 'Imagen muy grande', body: 'La imagen supera el máximo de 5 MB.' });
      setInfoOpen(true);
      return;
    }
    setUploadingFoto(true);
    try {
      await kardexApi.subirFoto(row.id_kardex, file);
      await qc.invalidateQueries({ queryKey: ['kardex'] });
    } catch (err: unknown) {
      setInfoMsg({
        title: 'No se pudo actualizar la foto',
        body: err instanceof Error ? err.message : 'Error al subir la foto',
      });
      setInfoOpen(true);
    } finally {
      setUploadingFoto(false);
    }
  }

  // El giro pendiente se descarta al cerrar el preview o al llegar una foto nueva.
  useEffect(() => {
    if (!previewOpen) setRot(0);
  }, [previewOpen]);
  useEffect(() => {
    setRot(0);
  }, [row.foto]);

  async function handleRotarSave() {
    if (!row.id_kardex) return;
    const g = (((rot % 360) + 360) % 360) as 0 | 90 | 180 | 270;
    if (g !== 90 && g !== 180 && g !== 270) {
      setRot(0);
      return;
    }
    setSavingRot(true);
    try {
      await kardexApi.rotarFoto(row.id_kardex, g);
      // Nueva URL (objeto nuevo) → refetch pinta la foto ya rotada; reseteamos giro.
      await qc.invalidateQueries({ queryKey: ['kardex'] });
      setRot(0);
      setPreviewHiResLoaded(false);
    } catch (e) {
      setInfoMsg({
        title: 'No se pudo rotar',
        body: e instanceof Error ? e.message : 'Error al rotar la foto',
      });
      setInfoOpen(true);
    } finally {
      setSavingRot(false);
    }
  }

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

  // Bailes editables inline (en el desplegable). Al togglear se guarda y el
  // trigger 012 recalcula `verificado` (sin baile → off; con baile → on).
  const mapBailes = (bs: KRow['bailes']): BaileSel[] =>
    Array.isArray(bs) ? bs.map((b) => ({ id_inscripcion: b.id_inscripcion, nombre_de_la_obra: b.nombre_de_la_obra })) : [];
  const [bailesLocal, setBailesLocal] = useState<BaileSel[]>(() => mapBailes(row.bailes));
  const [savingBailes, setSavingBailes] = useState(false);
  useEffect(() => { setBailesLocal(mapBailes(row.bailes)); }, [row.bailes]);

  async function handleBailesChange(next: BaileSel[]) {
    if (!row.id_kardex) return;
    const prev = bailesLocal;
    setBailesLocal(next);            // optimista
    setSavingBailes(true);
    try {
      await kardexApi.editar(row.id_kardex, { bailes: next });
      await qc.invalidateQueries({ queryKey: ['kardex'] });
    } catch (e: unknown) {
      setBailesLocal(prev);          // revertir
      setInfoMsg({ title: 'No se pudo guardar los bailes', body: e instanceof Error ? e.message : 'Error' });
      setInfoOpen(true);
    } finally {
      setSavingBailes(false);
    }
  }

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
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="min-w-0 truncate text-[13px] font-medium text-text-white">{nombre}</span>
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

        {canEdit && hasIdKardex && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setEditOpen(true);
            }}
            aria-label="Editar integrante"
            title="Editar integrante"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-glass-border text-text-65 transition hover:border-cyan/60 hover:text-cyan"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Bailarín (solo lectura) en SU propia fila: único control = cambiar su foto */}
        {canOwnFoto && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (!uploadingFoto) ownFotoInputRef.current?.click();
              }}
              aria-label="Cambiar mi foto de perfil"
              title="Cambiar mi foto de perfil"
              disabled={uploadingFoto}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-glass-border text-text-65 transition hover:border-cyan/60 hover:text-cyan disabled:opacity-60"
            >
              {uploadingFoto ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Camera className="h-3.5 w-3.5" />
              )}
            </button>
            <input
              ref={ownFotoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleOwnFotoChange}
              onClick={(e) => e.stopPropagation()}
              className="hidden"
            />
          </>
        )}

        {canManage && isCurrentYear && hasIdKardex && (
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
          {/* Acciones secundarias (Editar ya está en el header de la fila) */}
          {canDelete && hasIdKardex && (
            <div className="flex flex-wrap items-center gap-1.5 border-b border-glass-border px-3 py-2.5 sm:px-4">
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

            {/* Bailes en los que participa (obras de su agrupación).
                Editable inline si el usuario puede editar; si no, chips de solo
                lectura con buen contraste. */}
            {canEdit && hasIdKardex && row.id_agrupacion ? (
              <div className="pt-1.5">
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="text-[9px] uppercase text-text-45" style={{ letterSpacing: '0.5px' }}>
                    Baila en (obras de su agrupación)
                  </span>
                  {savingBailes && (
                    <span className="inline-flex items-center gap-1 text-[9px] text-cyan">
                      <Loader2 className="h-2.5 w-2.5 animate-spin" /> Guardando…
                    </span>
                  )}
                </div>
                <BailesMultiselect
                  idAgrupacion={row.id_agrupacion}
                  value={bailesLocal}
                  onChange={handleBailesChange}
                />
              </div>
            ) : Array.isArray(row.bailes) && row.bailes.length > 0 ? (
              <div className="pt-1.5">
                <span className="text-[9px] uppercase text-text-45" style={{ letterSpacing: '0.5px' }}>
                  Baila en
                </span>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {row.bailes.map((b) => (
                    <span
                      key={b.id_inscripcion}
                      className="inline-flex items-center gap-1 rounded-full border border-cyan/45 bg-cyan/15 px-2 py-0.5 text-[10px] font-semibold text-cyan"
                    >
                      <Music2 className="h-2.5 w-2.5" />
                      {b.nombre_de_la_obra}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

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
          onRegenerar={async () => {
            if (!row.id_kardex) return;
            setRegenerandoCred(true);
            try {
              await kardexApi.regenerarCredencial(row.id_kardex);
              setCredPreviewOpen(false);
              setInfoMsg({
                title: 'Regenerando credencial',
                body: 'La credencial se está generando y quedará vinculada en unos segundos. Volvé a abrirla en un momento.',
              });
              setInfoOpen(true);
            } catch (e) {
              setInfoMsg({ title: 'No se pudo regenerar', body: (e as Error).message || 'Error al iniciar la regeneración.' });
              setInfoOpen(true);
            } finally {
              setRegenerandoCred(false);
            }
          }}
          regenerando={regenerandoCred}
          onClose={() => setCredPreviewOpen(false)}
        />
      )}

      {previewOpen && row.foto &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-3 bg-black/90 p-6 anim-fade-in"
            onClick={() => setPreviewOpen(false)}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setPreviewOpen(false);
              }}
              aria-label="Cerrar"
              className="absolute right-4 top-4 z-[220] grid h-10 w-10 cursor-pointer place-items-center rounded-full border border-white/15 bg-black/55 text-white backdrop-blur-md transition hover:border-cyan hover:text-cyan"
            >
              <X className="h-5 w-5" />
            </button>
            <div
              onClick={(e) => e.stopPropagation()}
              className={`relative max-h-[70vh] max-w-full rounded-2xl shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)] ${
                rot % 360 === 0 ? 'overflow-hidden' : 'overflow-visible'
              }`}
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
                style={{ transform: rot % 360 !== 0 ? `rotate(${rot}deg)` : undefined }}
                className={`relative block max-h-[70vh] max-w-full transition-all duration-200 ${
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

            {/* Barra de rotación — JUSTO DEBAJO de la foto (solo editable). El
                giro se previsualiza al instante (CSS) y se persiste al Guardar. */}
            {canRotar && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="z-[210] flex items-center gap-1 rounded-full border border-white/15 bg-black/60 px-1.5 py-1 backdrop-blur-md"
              >
                <button
                  type="button"
                  onClick={() => setRot((r) => r - 90)}
                  disabled={savingRot}
                  aria-label="Girar a la izquierda"
                  title="Girar a la izquierda"
                  className="grid h-9 w-9 place-items-center rounded-full text-white transition hover:bg-white/15 disabled:opacity-50"
                >
                  <RotateCcw className="h-[18px] w-[18px]" />
                </button>
                <button
                  type="button"
                  onClick={() => setRot((r) => r + 180)}
                  disabled={savingRot}
                  aria-label="Girar 180 grados"
                  title="Girar 180°"
                  className="grid h-9 min-w-9 place-items-center rounded-full px-2 text-[11px] font-bold text-white transition hover:bg-white/15 disabled:opacity-50"
                >
                  180°
                </button>
                <button
                  type="button"
                  onClick={() => setRot((r) => r + 90)}
                  disabled={savingRot}
                  aria-label="Girar a la derecha"
                  title="Girar a la derecha"
                  className="grid h-9 w-9 place-items-center rounded-full text-white transition hover:bg-white/15 disabled:opacity-50"
                >
                  <RotateCw className="h-[18px] w-[18px]" />
                </button>
                {rot % 360 !== 0 && (
                  <button
                    type="button"
                    onClick={handleRotarSave}
                    disabled={savingRot}
                    className="ml-1 flex h-9 items-center gap-1.5 rounded-full bg-cyan px-3.5 text-[12px] font-bold uppercase text-[#04020F] transition hover:bg-[#66F0FF] disabled:opacity-60"
                    style={{ letterSpacing: '0.5px' }}
                  >
                    {savingRot ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BadgeCheck className="h-3.5 w-3.5" />}
                    {savingRot ? 'Guardando…' : 'Guardar'}
                  </button>
                )}
              </div>
            )}

            <p
              className="rounded-full bg-black/60 px-4 py-1.5 text-[12px] font-medium text-white backdrop-blur-md"
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
