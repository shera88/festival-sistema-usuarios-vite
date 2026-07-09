import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Play, Upload, CheckCircle2, Pencil, Video, Download } from 'lucide-react';
import { InscripcionPagosPanel } from '@/routes/tabs/PagosTab';
import type { Inscripcion, Nota } from '@/types/domain';
import { useAuth } from '@/hooks/useAuth';
import { EditarInscripcionModal } from './EditarInscripcionModal';
import { appsheetAudio } from '@/lib/utils/appsheet';
import { calcularPromedioFinal, fmtScore } from '@/lib/utils/scoring';
import { extractVimeoId } from '@/lib/utils/vimeo';
import { webpProxy } from '@/lib/utils/img';
import { JuradoCard } from './JuradoCard';
import { VideoModal } from './VideoModal';
import { AudioPlayer } from './AudioPlayer';
import { MultimediaDialog } from './MultimediaDialog';
import { multimediaApi } from '@/lib/api/multimedia';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { generoDeModalidad, GENERO_LABEL } from '@/lib/schemas/inscripcion';
import { mediaBaseName, mediaDownloadUrl } from '@/lib/utils/mediaName';
import { extFromUrl, sanitizeFilename } from '@/lib/utils/descargarArchivo';

interface Props {
  insc: Inscripcion;
  notas: Nota[];
  year: string;
}

type SubTab = 'detalles' | 'video' | 'calificacion' | 'pagos';

const CHIP_STYLE: Record<string, string> = {
  cat: 'text-cyan border-cyan/25',
  div: 'text-fuchsia border-fuchsia/25',
  sub: 'text-gold border-gold/25',
  mod: 'text-text-90 border-glass-border',
};

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

export function InscripcionCard({ insc, notas, year }: Props) {
  const mmEnabled = Number(year) >= 2026;
  const [open, setOpen] = useState(false);
  const [sub, setSub] = useState<SubTab>('detalles');
  const [logoFailed, setLogoFailed] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [mmOpen, setMmOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [infoMsg, setInfoMsg] = useState<{ title: string; body: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const { puedeEditar } = useAuth();
  const qc = useQueryClient();
  const mmConfirmado = !!insc.multimedia_confirmado;

  async function handleConfirmarMM() {
    setConfirming(true);
    try {
      await multimediaApi.confirmar(insc.id_inscripcion);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['inscripciones'] }),
        qc.invalidateQueries({ queryKey: ['multimedia', insc.id_inscripcion] }),
      ]);
      setConfirmOpen(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al confirmar';
      setInfoMsg({ title: 'No se pudo confirmar', body: msg });
      setInfoOpen(true);
      setConfirmOpen(false);
    } finally {
      setConfirming(false);
    }
  }

  const promedio = calcularPromedioFinal(notas);
  const agrupacionName = insc.agrupacion || '?';
  const initials = initialsOf(agrupacionName);
  const showImg = !!insc.enlace_del_logo && !logoFailed;
  // Audio: prefiere el de tabla multimedia (nuevo) sobre el legacy musica.
  const audioUrl = insc.audio_url_multimedia || appsheetAudio(insc.musica);
  const vimeoId = extractVimeoId(insc.url_video);

  // Nombre dinámico para descargar audio/video: "01.- Danzarte - The Black Panter - Martes"
  // (Orden - Agrupación - Obra - Día). Omite orden/día si faltan.
  const mediaBase = mediaBaseName(insc);
  const videoUrl = insc.video_led_url_multimedia;
  const videoFileName = videoUrl ? sanitizeFilename(mediaBase + extFromUrl(videoUrl, '.mp4')) : null;

  const chips: { variant: keyof typeof CHIP_STYLE; text: string }[] = [];
  if (insc.categoria) chips.push({ variant: 'cat', text: insc.categoria });
  if (insc.division) chips.push({ variant: 'div', text: insc.division });
  if (insc.subdivision) chips.push({ variant: 'sub', text: insc.subdivision });
  if (insc.modalidad) chips.push({ variant: 'mod', text: insc.modalidad });

  return (
    <article
      className={`overflow-hidden rounded-xl border transition anim-fade-in-up ${
        open
          ? 'border-cyan/25 shadow-[0_8px_32px_rgba(0,229,255,0.08)]'
          : 'border-cyan/10 hover:-translate-y-px hover:border-cyan/20'
      }`}
      style={{
        background: open
          ? 'linear-gradient(180deg, var(--bg-card) 0%, var(--bg-void) 100%)'
          : 'linear-gradient(180deg, var(--bg-card) 0%, var(--bg-elevated) 100%)',
      }}
    >
      <div className="flex w-full items-center gap-3 p-4">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
        <div
          className={`h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 transition ${
            open ? 'border-cyan shadow-[0_0_18px_rgba(0,229,255,0.25)]' : 'border-cyan/25 shadow-[0_0_12px_rgba(0,229,255,0.12)]'
          }`}
          style={{
            background: showImg ? 'var(--bg-elevated)' : gradientFor(agrupacionName),
          }}
        >
          {showImg ? (
            <img
              src={webpProxy(insc.enlace_del_logo, 96) ?? insc.enlace_del_logo!}
              alt={agrupacionName}
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
            className="truncate text-[10px] font-semibold uppercase text-text-65"
            style={{ letterSpacing: '0.6px' }}
          >
            {insc.agrupacion || 'Sin institución'}
          </div>
          <div className="text-[14px] font-bold leading-tight text-text-white">
            {insc.nombre_de_la_obra || 'Sin obra'}
          </div>
          {chips.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {chips.map((c, i) => (
                <span
                  key={i}
                  className={`rounded-md border bg-white/[0.03] px-1.5 py-px text-[8px] font-normal uppercase leading-tight ${CHIP_STYLE[c.variant]}`}
                  style={{ letterSpacing: '0.3px' }}
                >
                  {c.text}
                </span>
              ))}
            </div>
          )}
        </div>

        </button>

        {puedeEditar && (
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            aria-label="Editar datos de la obra"
            title="Editar datos de la obra"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-cyan/30 bg-cyan/10 text-cyan transition hover:bg-cyan/20"
          >
            <Pencil className="h-3.5 w-3.5" strokeWidth={2.2} />
          </button>
        )}

        {mmEnabled && puedeEditar && (
          <button
            type="button"
            onClick={() => setMmOpen(true)}
            aria-label="Subir multimedia (audio / video)"
            title={mmConfirmado ? 'Multimedia confirmada' : 'Subir audio / video'}
            className="relative grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-fuchsia/30 bg-fuchsia/10 text-fuchsia transition hover:bg-fuchsia/20"
          >
            <Upload className="h-3.5 w-3.5" strokeWidth={2.2} />
            {!mmConfirmado && !audioUrl && (
              <span
                className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 bg-gold"
                style={{ borderColor: 'var(--bg-card)' }}
                aria-hidden
              />
            )}
          </button>
        )}

        {mmEnabled && puedeEditar && (
          <button
            type="button"
            role="switch"
            aria-checked={mmConfirmado}
            aria-label={mmConfirmado ? 'Multimedia confirmada (bloqueado)' : 'Marcar audio/video como listos'}
            title={mmConfirmado ? 'Audio/video confirmados' : 'Marcar audio/video como listos'}
            disabled={confirming}
            onClick={() => {
              if (mmConfirmado) {
                setInfoMsg({
                  title: 'Multimedia confirmada',
                  body: 'Esta multimedia ya está confirmada. Contacte al administrador para revertir.',
                });
                setInfoOpen(true);
                return;
              }
              setConfirmOpen(true);
            }}
            className="relative h-[20px] w-9 shrink-0 cursor-pointer rounded-full border transition disabled:opacity-60"
            style={{
              background: mmConfirmado ? 'var(--cyan)' : 'rgba(255,255,255,0.08)',
              borderColor: mmConfirmado ? 'var(--cyan)' : 'var(--glass-border)',
            }}
          >
            <span
              className="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-white shadow transition-all"
              style={{ left: mmConfirmado ? 'calc(100% - 16px)' : '2px' }}
            />
          </button>
        )}

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Contraer' : 'Expandir'}
          className="shrink-0"
        >
          <ChevronDown
            className={`h-5 w-5 transition-transform duration-300 ${
              open ? 'rotate-180 text-cyan' : 'text-text-45'
            }`}
          />
        </button>
      </div>

      {open && (
        <div
          className="border-t border-cyan/10 px-4 pb-4 anim-fade-in"
          style={{
            background: 'linear-gradient(180deg, transparent 0%, var(--bg-void) 100%)',
          }}
        >
          <div className="mb-3 flex gap-1 overflow-x-auto border-b border-glass-border no-scrollbar">
            {([...(['detalles', 'video', 'calificacion'] as SubTab[]), ...(mmEnabled ? (['pagos'] as SubTab[]) : [])]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setSub(t)}
                className={`relative shrink-0 px-3.5 py-2 text-[11px] font-semibold uppercase transition ${
                  sub === t ? 'text-cyan' : 'text-text-45 hover:text-text-90'
                }`}
                style={{ letterSpacing: '0.6px' }}
              >
                {t === 'detalles' ? 'Detalles' : t === 'calificacion' ? 'Calificación' : t === 'pagos' ? 'Pagos' : 'Video'}
                {t === 'calificacion' && promedio !== null && (
                  <span className="ml-1.5 inline-flex items-center rounded-md bg-cyan-faint px-1.5 py-px text-[10px] font-bold text-cyan">
                    {fmtScore(promedio)}
                  </span>
                )}
                {sub === t && (
                  <span
                    className="absolute inset-x-0 -bottom-px h-[2px] rounded-sm anim-fade-in"
                    style={{
                      background: 'linear-gradient(90deg, var(--cyan), var(--fuchsia))',
                    }}
                  />
                )}
              </button>
            ))}
          </div>

          {sub === 'detalles' && (
            <>
              <div className="grid gap-3 sm:grid-cols-[repeat(auto-fit,minmax(140px,1fr))] py-1 pb-3.5">
                <Field label="Orden" value={insc.orden} />
                {/* Género derivado de la modalidad (correcto aunque el dato en BD venga mal). */}
                <Field
                  label="Género"
                  value={(() => { const g = generoDeModalidad(insc.modalidad ?? undefined); return g ? GENERO_LABEL[g] : (insc.genero ?? undefined); })()}
                />
                <Field label="Bloque" value={insc.bloque} />
                <Field label="Día" value={insc.dia} />
                <Field label="Coreógrafo" value={insc.coreografo} />
                <Field label="Director" value={insc.director} />
                <Field label="Cantidad" value={insc.cantidad} />
                <Field label="Duración" value={insc.duracion} />
                <Field label="Estado" value={insc.estado} />
                <Field label="Formato" value={insc.formato_de_inscripcion} />
              </div>
              {videoUrl && (
                <div className="mt-3 rounded-xl border border-fuchsia/25 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div
                      className="flex items-center gap-2 text-[10px] font-medium uppercase text-fuchsia"
                      style={{ letterSpacing: '0.5px' }}
                    >
                      <Video className="h-3.5 w-3.5" />
                      Video Para Pantallas
                    </div>
                    {videoUrl && videoFileName && (
                      <a
                        href={mediaDownloadUrl(videoUrl, videoFileName)}
                        download={videoFileName}
                        className="flex shrink-0 items-center gap-1 rounded-md border border-fuchsia/40 bg-fuchsia/10 px-2 py-1 text-[10px] font-semibold uppercase text-fuchsia transition hover:bg-fuchsia/20"
                        style={{ letterSpacing: '0.4px' }}
                      >
                        <Download className="h-3 w-3" />
                        Descargar
                      </a>
                    )}
                  </div>
                  {videoFileName && (
                    <div className="mb-2 truncate text-[11px] text-text-90" title={videoFileName}>
                      {videoFileName}
                    </div>
                  )}
                  <video
                    src={videoUrl}
                    controls
                    preload="metadata"
                    playsInline
                    className="w-full rounded-md border border-glass-border bg-black"
                    style={{ maxHeight: 280 }}
                  />
                </div>
              )}
              {audioUrl && (
                <div className="mt-3">
                  <AudioPlayer src={audioUrl} downloadName={mediaBase} />
                </div>
              )}
              {mmEnabled && (
              <div className="mt-3 flex items-center gap-2 rounded-md border border-glass-border bg-glass-bg px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-semibold uppercase text-text-65" style={{ letterSpacing: '0.5px' }}>
                    Subir multimedia
                  </div>
                  {mmConfirmado ? (
                    <div className="mt-0.5 flex items-center gap-1 text-[10px] text-cyan">
                      <CheckCircle2 className="h-3 w-3" />
                      Confirmada como versión final
                    </div>
                  ) : (
                    <div className="mt-0.5 text-[10px] text-text-45">
                      Audio obligatorio · Video opcional
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setMmOpen(true)}
                  aria-label="Gestionar multimedia"
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-cyan/40 bg-cyan/10 text-cyan transition hover:bg-cyan/20"
                >
                  <Upload className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  role="switch"
                  aria-checked={mmConfirmado}
                  aria-label={mmConfirmado ? 'Multimedia confirmada (bloqueado)' : 'Marcar como confirmado'}
                  disabled={confirming}
                  onClick={() => {
                    if (mmConfirmado) {
                      setInfoMsg({
                        title: 'Multimedia confirmada',
                        body: 'Esta multimedia ya está confirmada. Contacte al administrador para revertir.',
                      });
                      setInfoOpen(true);
                      return;
                    }
                    setConfirmOpen(true);
                  }}
                  className="relative h-[18px] w-8 shrink-0 cursor-pointer rounded-full border transition disabled:opacity-60"
                  style={{
                    background: mmConfirmado ? 'var(--cyan)' : 'rgba(255,255,255,0.08)',
                    borderColor: mmConfirmado ? 'var(--cyan)' : 'var(--glass-border)',
                  }}
                >
                  <span
                    className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-white shadow transition-all"
                    style={{ left: mmConfirmado ? 'calc(100% - 14px)' : '2px' }}
                  />
                </button>
              </div>
              )}
              {insc.informe && (
                <div
                  className="mt-3 rounded-md border-l-2 border-cyan/40 px-3.5 py-2.5 text-[12px] text-text-90"
                  style={{ background: 'rgba(0,229,255,0.04)', lineHeight: '1.55' }}
                >
                  <strong className="font-semibold text-cyan">Informe: </strong>
                  {insc.informe}
                </div>
              )}
            </>
          )}

          {sub === 'calificacion' && (
            <>
              {notas.length === 0 ? (
                <p className="py-6 text-center text-[13px] italic text-text-45">
                  Sin calificaciones para esta obra.
                </p>
              ) : (
                <>
                  <div
                    className="mb-2.5 flex items-center justify-between gap-3 rounded-lg border border-gold/15 px-3 py-2.5"
                    style={{
                      background:
                        'linear-gradient(135deg, rgba(232,208,152,0.05) 0%, rgba(0,229,255,0.03) 100%)',
                    }}
                  >
                    <div className="flex flex-col">
                      <div
                        className="text-[8px] uppercase text-text-45"
                        style={{ letterSpacing: '1px' }}
                      >
                        Puntaje
                      </div>
                      <div className="mt-0.5 text-[10px] text-text-65">
                        {notas.length} jurado{notas.length > 1 ? 's' : ''}
                      </div>
                    </div>
                    <div className="font-display text-2xl font-bold leading-none gradient-text-cf">
                      {fmtScore(promedio)}
                      <small className="ml-0.5 text-[11px] font-normal text-text-45">/100</small>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    {notas.map((n, i) => (
                      <JuradoCard key={i} nota={n} />
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {sub === 'video' && (
            <>
              {vimeoId ? (
                <button
                  type="button"
                  onClick={() => setVideoOpen(true)}
                  className="group relative block w-full max-w-xs overflow-hidden rounded-lg border border-glass-border transition hover:border-cyan/60 hover:shadow-[0_8px_24px_rgba(0,229,255,0.18)]"
                >
                  <img
                    src={`https://vumbnail.com/${vimeoId}.jpg`}
                    alt={insc.nombre_de_la_obra || 'Video'}
                    className="aspect-video w-full object-cover transition group-hover:scale-105"
                    loading="lazy"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <div
                    className="absolute inset-0 flex items-center justify-center transition group-hover:bg-black/30"
                    style={{ background: 'linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.55) 100%)' }}
                  >
                    <span
                      className="grid h-12 w-12 place-items-center rounded-full border-2 border-cyan bg-cyan/20 text-cyan backdrop-blur-sm transition group-hover:scale-110 group-hover:bg-cyan/30"
                      style={{ boxShadow: '0 0 24px rgba(0,229,255,0.4)' }}
                    >
                      <Play className="h-5 w-5 translate-x-0.5 fill-current" />
                    </span>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 px-3 py-2 text-left">
                    <p className="text-[11px] font-medium uppercase text-cyan" style={{ letterSpacing: '0.6px' }}>
                      Ver presentación
                    </p>
                  </div>
                </button>
              ) : (
                <p className="py-10 text-center text-[13px] italic text-text-45">
                  El video de esta presentación estará disponible próximamente.
                </p>
              )}
            </>
          )}

          {sub === 'pagos' && <InscripcionPagosPanel insc={insc} />}
        </div>
      )}
      {vimeoId && (
        <VideoModal
          open={videoOpen}
          onClose={() => setVideoOpen(false)}
          vimeoId={vimeoId}
          insc={insc}
        />
      )}
      <MultimediaDialog open={mmOpen} inscripcion={insc} onClose={() => setMmOpen(false)} />

      <EditarInscripcionModal
        inscripcion={editOpen ? insc : null}
        onClose={() => setEditOpen(false)}
        onSaved={() => {
          setEditOpen(false);
          void qc.invalidateQueries({ queryKey: ['inscripciones'] });
          void qc.invalidateQueries({ queryKey: ['pagos-resumen'] });
        }}
      />

      <ConfirmDialog
        open={confirmOpen}
        variant="primary"
        title="¿Confirmar multimedia como final?"
        message={
          <>
            <p>Confirma que esta es la versión final del audio (y video si corresponde).</p>
            <p className="mt-2 text-text-45">
              <strong className="text-text-65">Una vez confirmado, no se podrán reemplazar ni eliminar los archivos</strong> hasta que el administrador revierta.
            </p>
            <p className="mt-2 text-[12px] text-text-65">
              Si aún no subió el audio, el sistema rechazará la confirmación.
            </p>
          </>
        }
        confirmText="Sí, confirmar"
        cancelText="Cancelar"
        loading={confirming}
        onConfirm={handleConfirmarMM}
        onClose={() => {
          if (!confirming) setConfirmOpen(false);
        }}
      />

      <ConfirmDialog
        open={infoOpen}
        variant="info"
        hideCancel
        title={infoMsg?.title ?? ''}
        message={<p>{infoMsg?.body ?? ''}</p>}
        onClose={() => setInfoOpen(false)}
      />
    </article>
  );
}

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="min-w-0">
      <div
        className="mb-0.5 text-[9px] uppercase text-text-45"
        style={{ letterSpacing: '0.8px' }}
      >
        {label}
      </div>
      <div className="break-words text-[12px] font-medium leading-tight text-text-white">
        {value}
      </div>
    </div>
  );
}
