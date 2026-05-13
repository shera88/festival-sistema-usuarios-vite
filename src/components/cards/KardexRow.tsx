import { useState } from 'react';
import { ChevronDown, MessageCircle } from 'lucide-react';
import type { KardexRow as KRow } from '@/types/domain';
import { whatsappLink } from '@/lib/utils/whatsapp';

interface Props {
  row: KRow;
}

export function KardexRow({ row }: Props) {
  const [open, setOpen] = useState(false);
  const nombre = row.nombre_y_apellido || 'Sin nombre';
  const initial = nombre.charAt(0).toUpperCase();
  const wa = whatsappLink(row.telefono);

  return (
    <div className="border-b border-glass-border transition last:border-b-0 hover:bg-fuchsia/[0.02]">
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex flex-1 items-center gap-3 text-left"
        >
          <div
            className="h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 border-glass-border"
            style={{ background: 'var(--bg-elevated)' }}
          >
            {row.foto ? (
              <img src={row.foto} alt={nombre} className="h-full w-full object-cover" />
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
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium text-text-white">{nombre}</div>
            <div
              className="mt-0.5 truncate text-[10px] uppercase text-text-45"
              style={{ letterSpacing: '0.4px' }}
            >
              {row.cargo || '—'}
            </div>
          </div>
        </button>
        {wa && (
          <a
            href={wa}
            target="_blank"
            rel="noopener"
            aria-label="WhatsApp"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-glass-border text-text-65 transition hover:border-green hover:text-green"
          >
            <MessageCircle className="h-4 w-4" />
          </a>
        )}
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform duration-300 ${
            open ? 'rotate-180 text-fuchsia' : 'text-text-45'
          }`}
        />
      </div>
      {open && (
        <div className="space-y-1.5 border-t border-glass-border bg-black/20 px-4 py-3 text-[11px] anim-fade-in">
          <Detail label="Teléfono" value={row.telefono} />
          <Detail label="Correo" value={row.correo_electronico} />
          <Detail label="CI" value={row.ci} />
          <Detail label="Ciudad" value={row.ciudad} />
          <Detail label="Edad" value={row.edad} />
          <Detail label="Estado" value={row.estado} />
          {(row.enlace_del_credencial || row.enlace_del_certificado) && (
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
          )}
        </div>
      )}
    </div>
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
