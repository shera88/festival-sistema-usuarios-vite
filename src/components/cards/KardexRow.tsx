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
    <div className="overflow-hidden rounded-xl border border-glass-border bg-base/40">
      <div className="flex items-center gap-3 p-2.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex flex-1 items-center gap-3 text-left"
        >
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-glass-border">
            {row.foto ? (
              <img src={row.foto} alt={nombre} className="h-full w-full object-cover" />
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
            <div className="text-text-45 text-xs truncate">{row.cargo || '—'}</div>
          </div>
        </button>
        {wa && (
          <a
            href={wa}
            target="_blank"
            rel="noopener"
            aria-label="WhatsApp"
            className="rounded-full p-1.5 text-green-400 hover:bg-green-400/10"
          >
            <MessageCircle className="h-4 w-4" />
          </a>
        )}
        <ChevronDown
          className={`h-4 w-4 text-text-45 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </div>
      {open && (
        <div className="border-t border-glass-border p-3 space-y-2 text-xs">
          <Detail label="Teléfono" value={row.telefono} />
          <Detail label="Correo" value={row.correo_electronico} />
          <Detail label="CI" value={row.ci} />
          <Detail label="Ciudad" value={row.ciudad} />
          <Detail label="Edad" value={row.edad} />
          <Detail label="Estado" value={row.estado} />
          <div className="flex gap-2 pt-1">
            {row.enlace_del_credencial && (
              <a
                href={row.enlace_del_credencial}
                target="_blank"
                rel="noopener"
                className="rounded border border-cyan/40 px-2 py-1 text-xs text-cyan hover:bg-cyan/10"
              >
                Credencial
              </a>
            )}
            {row.enlace_del_certificado && (
              <a
                href={row.enlace_del_certificado}
                target="_blank"
                rel="noopener"
                className="rounded border border-fuchsia/40 px-2 py-1 text-xs text-fuchsia hover:bg-fuchsia/10"
              >
                Certificado
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | number | null }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-text-45 text-[10px] uppercase">{label}</span>
      <span className="text-text-90 truncate">{value}</span>
    </div>
  );
}
