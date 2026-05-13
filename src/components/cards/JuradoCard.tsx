import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { Nota } from '@/types/domain';
import { appsheetJuradoFoto } from '@/lib/utils/appsheet';
import { calcularPromedioJurado } from '@/lib/utils/scoring';

interface Props {
  nota: Nota;
}

export function JuradoCard({ nota }: Props) {
  const [open, setOpen] = useState(false);
  const total = calcularPromedioJurado(nota);
  const foto = appsheetJuradoFoto(nota.jurado_foto);
  const nombre = nota.jurado_nombre || nota.jurado || 'Jurado';
  const initial = nombre.charAt(0).toUpperCase();
  const generos = (nota.jurado_generos || '')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  return (
    <div className="overflow-hidden rounded-xl border border-glass-border bg-glass-bg">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 p-2.5 text-left hover:bg-white/5"
      >
        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-glass-border">
          {foto ? (
            <img src={foto} alt={nombre} className="h-full w-full object-cover" />
          ) : (
            <div
              className="h-full w-full flex items-center justify-center text-white text-sm font-semibold"
              style={{ background: 'linear-gradient(135deg,var(--cyan),var(--fuchsia))' }}
            >
              {initial}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-text-90 text-sm truncate">{nombre}</div>
          {generos.length > 0 && (
            <div className="mt-0.5 flex flex-wrap gap-1">
              {generos.map((g) => (
                <span
                  key={g}
                  className={`rounded px-1.5 py-0.5 text-[9px] uppercase ${generoClass(g)}`}
                >
                  {g}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-text-90">{total}</div>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-text-45 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="border-t border-glass-border bg-base/40 p-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <NotaItem label="Temática" value={nota.tematica} />
            <NotaItem label="Interpretación" value={nota.interpretacion} />
            <NotaItem label="Coreografía" value={nota.coreografia} />
            <NotaItem label="Dificultad" value={nota.dificultad_y_ejecucion} />
          </div>
          {nota.comentario && (
            <p className="mt-2 rounded border border-glass-border bg-glass-bg p-2 text-xs italic text-text-90">
              "{nota.comentario}"
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function NotaItem({ label, value }: { label: string; value: number | string | null }) {
  return (
    <div className="rounded border border-glass-border bg-glass-bg p-2 text-center">
      <div className="text-[10px] uppercase text-text-45">{label}</div>
      <div className="text-sm font-semibold text-text-90">{value ?? '—'}</div>
    </div>
  );
}

function generoClass(g: string): string {
  if (g === 'FOLKLORE') return 'bg-gold/20 text-gold border border-gold/40';
  if (g === 'URBANO') return 'bg-fuchsia/20 text-fuchsia border border-fuchsia/40';
  if (g === 'ACADEMICO' || g === 'ACADÉMICO')
    return 'bg-cyan/20 text-cyan border border-cyan/40';
  return 'bg-glass-bg text-text-45 border border-glass-border';
}
