import { useState } from 'react';
import { ChevronDown, Play, Music } from 'lucide-react';
import type { Inscripcion, Nota } from '@/types/domain';
import { appsheetAudio } from '@/lib/utils/appsheet';
import { calcularPromedioFinal, fmtScore } from '@/lib/utils/scoring';
import { extractVimeoId, vimeoEmbedUrl } from '@/lib/utils/vimeo';
import { JuradoCard } from './JuradoCard';

interface Props {
  insc: Inscripcion;
  notas: Nota[];
}

type SubTab = 'detalles' | 'calificacion' | 'video';

const CHIP_STYLE: Record<string, string> = {
  cat: 'text-cyan border-cyan/25',
  div: 'text-fuchsia border-fuchsia/25',
  sub: 'text-gold border-gold/25',
  mod: 'text-text-90 border-glass-border',
};

export function InscripcionCard({ insc, notas }: Props) {
  const [open, setOpen] = useState(false);
  const [sub, setSub] = useState<SubTab>('detalles');

  const promedio = calcularPromedioFinal(notas);
  const initial = (insc.agrupacion || '?').charAt(0).toUpperCase();
  const audioUrl = appsheetAudio(insc.musica);
  const vimeoId = extractVimeoId(insc.url_video);

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
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <div
          className={`h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 transition ${
            open ? 'border-cyan shadow-[0_0_18px_rgba(0,229,255,0.25)]' : 'border-cyan/25 shadow-[0_0_12px_rgba(0,229,255,0.12)]'
          }`}
          style={{ background: 'var(--bg-elevated)' }}
        >
          {insc.enlace_del_logo ? (
            <img
              src={insc.enlace_del_logo}
              alt={insc.agrupacion ?? ''}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center font-display text-lg font-bold text-cyan">
              {initial}
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

        <ChevronDown
          className={`h-5 w-5 shrink-0 transition-transform duration-300 ${
            open ? 'rotate-180 text-cyan' : 'text-text-45'
          }`}
        />
      </button>

      {open && (
        <div
          className="border-t border-cyan/10 px-4 pb-4 anim-fade-in"
          style={{
            background: 'linear-gradient(180deg, transparent 0%, var(--bg-void) 100%)',
          }}
        >
          <div className="mb-3 flex gap-1 overflow-x-auto border-b border-glass-border no-scrollbar">
            {(['detalles', 'calificacion', 'video'] as SubTab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setSub(t)}
                className={`relative shrink-0 px-3.5 py-2 text-[11px] font-semibold uppercase transition ${
                  sub === t ? 'text-cyan' : 'text-text-45 hover:text-text-90'
                }`}
                style={{ letterSpacing: '0.6px' }}
              >
                {t === 'detalles' ? 'Detalles' : t === 'calificacion' ? 'Calificación' : 'Video'}
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
                <Field label="Género" value={insc.genero} />
                <Field label="Bloque" value={insc.bloque} />
                <Field label="Día" value={insc.dia} />
                <Field label="Coreógrafo" value={insc.coreografo} />
                <Field label="Director" value={insc.director} />
                <Field label="Cantidad" value={insc.cantidad} />
                <Field label="Duración" value={insc.duracion} />
                <Field label="Estado" value={insc.estado} />
                <Field label="Formato" value={insc.formato_de_inscripcion} />
              </div>
              {audioUrl && (
                <a
                  href={audioUrl}
                  target="_blank"
                  rel="noopener"
                  className="mt-3 inline-flex items-center gap-2.5 rounded-xl border border-cyan/25 px-4 py-2.5 text-[12px] font-semibold text-cyan transition hover:-translate-y-px hover:border-cyan/50 hover:shadow-[0_4px_16px_rgba(0,229,255,0.15)]"
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(0,229,255,0.08) 0%, rgba(255,31,168,0.06) 100%)',
                  }}
                >
                  <Music className="h-4 w-4" />
                  <span>Audio de la obra</span>
                  <Play className="h-3.5 w-3.5 opacity-70" />
                </a>
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
                    className="mb-3.5 flex flex-col items-center rounded-xl border border-gold/15 px-4 py-5"
                    style={{
                      background:
                        'linear-gradient(135deg, rgba(232,208,152,0.06) 0%, rgba(0,229,255,0.04) 100%)',
                    }}
                  >
                    <div
                      className="mb-1.5 text-[10px] uppercase text-text-45"
                      style={{ letterSpacing: '1.5px' }}
                    >
                      Puntaje
                    </div>
                    <div className="font-display text-5xl font-bold leading-none gradient-text-cf">
                      {fmtScore(promedio)}
                      <small className="ml-0.5 text-lg font-normal text-text-45">/100</small>
                    </div>
                    <div className="mt-1.5 text-[11px] text-text-65">
                      {notas.length} jurado{notas.length > 1 ? 's' : ''} calificaron
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
                <div className="overflow-hidden rounded-md border border-glass-border">
                  <iframe
                    src={vimeoEmbedUrl(vimeoId)}
                    className="aspect-video w-full"
                    allowFullScreen
                    title={insc.nombre_de_la_obra || 'Video'}
                  />
                </div>
              ) : (
                <p className="py-10 text-center text-[13px] italic text-text-45">
                  El video de esta presentación estará disponible próximamente.
                </p>
              )}
            </>
          )}
        </div>
      )}
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
