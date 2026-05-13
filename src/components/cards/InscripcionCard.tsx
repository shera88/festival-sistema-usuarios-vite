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

export function InscripcionCard({ insc, notas }: Props) {
  const [open, setOpen] = useState(false);
  const [sub, setSub] = useState<SubTab>('detalles');

  const promedio = calcularPromedioFinal(notas);
  const initial = (insc.agrupacion || '?').charAt(0).toUpperCase();
  const audioUrl = appsheetAudio(insc.musica);
  const vimeoId = extractVimeoId(insc.url_video);

  const chips: { cls: string; text: string }[] = [];
  if (insc.categoria) chips.push({ cls: 'border-cyan/40 text-cyan', text: insc.categoria });
  if (insc.division) chips.push({ cls: 'border-fuchsia/40 text-fuchsia', text: insc.division });
  if (insc.subdivision) chips.push({ cls: 'border-gold/40 text-gold', text: insc.subdivision });
  if (insc.modalidad) chips.push({ cls: 'border-white/20 text-text-90', text: insc.modalidad });

  return (
    <div className="overflow-hidden rounded-2xl border border-glass-border bg-glass-bg backdrop-blur-md">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 p-3 text-left hover:bg-white/5"
      >
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-glass-border">
          {insc.enlace_del_logo ? (
            <img
              src={insc.enlace_del_logo}
              alt={insc.agrupacion ?? ''}
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              className="h-full w-full flex items-center justify-center text-white font-semibold"
              style={{ background: 'linear-gradient(135deg,var(--cyan),var(--fuchsia))' }}
            >
              {initial}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-text-45 text-xs truncate">{insc.agrupacion || 'Sin institución'}</div>
          <div className="text-text-90 font-medium truncate">
            {insc.nombre_de_la_obra || 'Sin obra'}
          </div>
          {chips.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {chips.map((c, i) => (
                <span
                  key={i}
                  className={`rounded border px-1.5 py-0.5 text-[10px] uppercase ${c.cls}`}
                >
                  {c.text}
                </span>
              ))}
            </div>
          )}
        </div>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-text-45 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="border-t border-glass-border bg-base/40 p-3">
          <div className="mb-3 flex gap-1 border-b border-glass-border">
            {(['detalles', 'calificacion', 'video'] as SubTab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setSub(t)}
                className={`relative px-3 py-2 text-xs font-medium uppercase ${
                  sub === t ? 'text-text-90' : 'text-text-45 hover:text-text-90'
                }`}
              >
                {t === 'detalles' ? 'Detalles' : t === 'calificacion' ? 'Calificación' : 'Video'}
                {t === 'calificacion' && promedio !== null && (
                  <span className="ml-1 rounded bg-cyan/20 px-1 text-[10px] text-cyan">
                    {fmtScore(promedio)}
                  </span>
                )}
                {sub === t && (
                  <span
                    className="absolute inset-x-2 bottom-0 h-[2px] rounded-full"
                    style={{ background: 'linear-gradient(90deg, var(--cyan), var(--fuchsia))' }}
                  />
                )}
              </button>
            ))}
          </div>

          {sub === 'detalles' && (
            <>
              <div className="grid grid-cols-2 gap-3 text-xs">
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
                  className="mt-3 inline-flex items-center gap-2 rounded-lg border border-glass-border bg-glass-bg px-3 py-1.5 text-xs text-text-90 hover:border-cyan/40"
                >
                  <Music className="h-3.5 w-3.5" />
                  Audio de la obra
                  <Play className="h-3 w-3" />
                </a>
              )}
              {insc.informe && (
                <p className="mt-3 rounded border border-glass-border bg-glass-bg p-2 text-xs text-text-90">
                  <strong>Informe:</strong> {insc.informe}
                </p>
              )}
            </>
          )}

          {sub === 'calificacion' && (
            <>
              {notas.length === 0 ? (
                <p className="py-4 text-center text-xs italic text-text-45">
                  Sin calificaciones para esta obra.
                </p>
              ) : (
                <>
                  <div className="mb-3 rounded-xl border border-glass-border bg-glass-bg p-3 text-center">
                    <div className="text-xs uppercase text-text-45">Puntaje</div>
                    <div className="text-3xl font-bold text-text-90">
                      {fmtScore(promedio)}
                      <small className="text-sm text-text-45">/100</small>
                    </div>
                    <div className="text-xs text-text-45">
                      {notas.length} jurado{notas.length > 1 ? 's' : ''} calificaron
                    </div>
                  </div>
                  <div className="space-y-2">
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
                <div className="aspect-video w-full overflow-hidden rounded-lg border border-glass-border">
                  <iframe
                    src={vimeoEmbedUrl(vimeoId)}
                    className="h-full w-full"
                    allowFullScreen
                    title={insc.nombre_de_la_obra || 'Video'}
                  />
                </div>
              ) : (
                <p className="py-6 text-center text-xs italic text-text-45">
                  El video de esta presentación estará disponible próximamente.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div>
      <div className="text-text-45 text-[10px] uppercase tracking-wide">{label}</div>
      <div className="text-text-90 text-xs">{value}</div>
    </div>
  );
}
