import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, AlertCircle, Save } from 'lucide-react';
import { inscripcionesApi } from '@/lib/api/inscripciones';
import { ModalidadPicker } from '@/components/inscripcion/ModalidadPicker';
import { ButtonGroup } from '@/components/ui/button-group';
import { MODALIDADES, CATEGORIAS, DIVISIONES, generoDeModalidad, GENERO_LABEL } from '@/lib/schemas/inscripcion';

const FONT_DISPLAY = "'Inter Tight', 'Inter', system-ui, sans-serif";
const FONT_MONO = "'JetBrains Mono', 'SF Mono', Menlo, monospace";

// La BD guarda la etiqueta en MAYÚSCULA (upper_norm del label PHP). Para prellenar
// los ButtonGroup necesito el value slug → mapa inverso etiqueta(BD) → value,
// normalizando acentos ("AGRUPACIÓN" → "AGRUPACION").
const normLabel = (s?: string | null) =>
  (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();

const CAT_LABEL_TO_VALUE: Record<string, string> = {
  COLEGIOS: 'colegios', UNIVERSIDADES: 'universidades', AGRUPACION: 'agrupacion', AGRUPACIONES: 'agrupacion',
};
const DIV_LABEL_TO_VALUE: Record<string, string> = {
  'PRE INFANTIL': 'pre_infantil', INFANTIL: 'infantil', 'PRE JUVENIL': 'pre_juvenil',
  JUVENIL: 'juvenil', MAYORES: 'mayores', ADULTOS: 'adultos',
};

export interface InscripcionEditable {
  id_inscripcion: string;
  nombre_de_la_obra: string | null;
  cantidad: string | number | null;
  modalidad: string | null;
  categoria?: string | null;
  division?: string | null;
}

interface Props {
  inscripcion: InscripcionEditable | null;
  onClose: () => void;
  onSaved: () => void;
}

export function EditarInscripcionModal({ inscripcion, onClose, onSaved }: Props) {
  const [obra, setObra] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [modalidad, setModalidad] = useState('');
  const [categoria, setCategoria] = useState('');
  const [division, setDivision] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!inscripcion) return;
    setObra(inscripcion.nombre_de_la_obra ?? '');
    setCantidad(inscripcion.cantidad != null ? String(inscripcion.cantidad) : '');
    setModalidad(inscripcion.modalidad ?? '');
    setCategoria(CAT_LABEL_TO_VALUE[normLabel(inscripcion.categoria)] ?? '');
    setDivision(DIV_LABEL_TO_VALUE[normLabel(inscripcion.division)] ?? '');
    setErr(null);
  }, [inscripcion]);

  useEffect(() => {
    if (!inscripcion) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape' && !saving) onClose(); }
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [inscripcion, onClose, saving]);

  if (!inscripcion) return null;

  // Género se DERIVA de la modalidad (no es editable), igual que en el formulario.
  const generoCode = generoDeModalidad(modalidad);
  const generoLabel = generoCode ? GENERO_LABEL[generoCode] : '—';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const insc = inscripcion;
    if (!insc) return;
    const obraTrim = obra.trim();
    const n = Math.floor(Number(cantidad));
    if (obraTrim.length < 2) { setErr('Ingrese el nombre de la obra'); return; }
    if (!isFinite(n) || n < 1 || n > 60) { setErr('Cantidad de participantes: 1 a 60'); return; }
    if (!categoria) { setErr('Seleccione la categoría'); return; }
    if (!division) { setErr('Seleccione la subcategoría'); return; }
    if (!modalidad || modalidad.length < 2) { setErr('Seleccione la modalidad'); return; }

    setSaving(true);
    try {
      await inscripcionesApi.editar({
        id_inscripcion: insc.id_inscripcion,
        nombre_de_la_obra: obraTrim,
        cantidad: n,
        modalidad,
        categoria,
        division,
      });
      onSaved();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/90 sm:items-center sm:p-6"
      onClick={() => !saving && onClose()}
      style={{ animation: 'egFade 0.18s ease-out' }}
    >
      <style>{`@keyframes egFade{from{opacity:0}to{opacity:1}}@keyframes egSlide{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-white/[0.08] sm:rounded-3xl"
        style={{ background: '#0a0817', animation: 'egSlide 0.26s cubic-bezier(0.22,1,0.36,1)', boxShadow: '0 20px 60px -20px rgba(6,182,212,0.35)' }}
      >
        <header className="flex items-center gap-3 border-b border-white/[0.05] px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="text-[9.5px] font-bold uppercase text-cyan" style={{ letterSpacing: '1.6px', fontFamily: FONT_DISPLAY }}>
              Editar inscripción
            </div>
            <div className="mt-1 truncate text-[14px] font-semibold text-text-white" style={{ fontFamily: FONT_DISPLAY }}>
              {inscripcion.nombre_de_la_obra || 'Obra'}
            </div>
          </div>
          <button
            type="button"
            onClick={() => !saving && onClose()}
            disabled={saving}
            aria-label="Cerrar"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-text-45 transition hover:bg-white/[0.05] hover:text-white disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="flex-1 space-y-5 overflow-y-auto px-5 py-5" style={{ overscrollBehavior: 'contain' }}>
          {/* Obra */}
          <label className="block">
            <span className="mb-2 block text-[9.5px] font-bold uppercase text-text-45" style={{ letterSpacing: '1.4px', fontFamily: FONT_DISPLAY }}>
              Nombre de la obra
            </span>
            <input
              type="text"
              value={obra}
              onChange={(e) => setObra(e.target.value)}
              maxLength={180}
              required
              placeholder="Nombre de la obra"
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-[14px] text-text-white outline-none transition focus:border-cyan/40"
              style={{ fontFamily: FONT_DISPLAY }}
            />
          </label>

          {/* Categoría */}
          <div>
            <span className="mb-2 block text-[9.5px] font-bold uppercase text-text-45" style={{ letterSpacing: '1.4px', fontFamily: FONT_DISPLAY }}>
              Categoría
            </span>
            <ButtonGroup
              options={[...CATEGORIAS]}
              value={categoria}
              onChange={setCategoria}
              size="md"
              className="grid-cols-1 sm:grid-cols-3 gap-2"
            />
          </div>

          {/* Subcategoría (división por edad) */}
          <div>
            <span className="mb-2 block text-[9.5px] font-bold uppercase text-text-45" style={{ letterSpacing: '1.4px', fontFamily: FONT_DISPLAY }}>
              Subcategoría <span className="text-text-25">(por edad)</span>
            </span>
            <ButtonGroup
              options={[...DIVISIONES]}
              value={division}
              onChange={setDivision}
              size="md"
              className="grid-cols-2 sm:grid-cols-3 gap-2"
            />
          </div>

          {/* Total de participantes */}
          <label className="block">
            <span className="mb-2 block text-[9.5px] font-bold uppercase text-text-45" style={{ letterSpacing: '1.4px', fontFamily: FONT_DISPLAY }}>
              Total de participantes
            </span>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              max="60"
              step="1"
              value={cantidad}
              onChange={(e) => {
                const v = e.target.value;
                if (v === '') { setCantidad(''); return; }
                const n = Math.floor(Number(v));
                if (!isFinite(n) || n < 0) return;
                setCantidad(String(n));
              }}
              required
              placeholder="0"
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-[18px] font-semibold text-text-white outline-none transition focus:border-cyan/40"
              style={{ fontFamily: FONT_MONO, fontVariantNumeric: 'tabular-nums' }}
            />
            <span className="mt-1.5 block text-[10px] text-text-45" style={{ fontFamily: FONT_DISPLAY }}>
              Ajusta también el número inicial de credenciales.
            </span>
          </label>

          {/* Modalidad → género derivado */}
          <div>
            <span className="mb-2 block text-[9.5px] font-bold uppercase text-text-45" style={{ letterSpacing: '1.4px', fontFamily: FONT_DISPLAY }}>
              Modalidad
            </span>
            <ModalidadPicker modalidades={MODALIDADES} value={modalidad} onChange={setModalidad} />
            <div className="mt-2 flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5">
              <span className="text-[10px] font-semibold uppercase text-text-45" style={{ letterSpacing: '0.8px', fontFamily: FONT_DISPLAY }}>
                Género (según modalidad)
              </span>
              <span className="text-[12.5px] font-bold text-cyan" style={{ fontFamily: FONT_DISPLAY }}>
                {generoLabel}
              </span>
            </div>
          </div>

          {err && (
            <div className="flex items-start gap-2 rounded-xl border border-red-500/35 px-3 py-2.5 text-[11.5px] text-red-400" style={{ background: 'rgba(239,68,68,0.05)', fontFamily: FONT_DISPLAY }}>
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{err}</span>
            </div>
          )}
        </form>

        <footer className="flex gap-2 border-t border-white/[0.05] px-5 py-4">
          <button
            type="button"
            onClick={() => !saving && onClose()}
            disabled={saving}
            className="flex-1 rounded-full border border-white/[0.08] px-4 py-3 text-[10.5px] font-bold uppercase text-text-65 transition hover:bg-white/[0.04] disabled:opacity-50"
            style={{ letterSpacing: '0.9px', fontFamily: FONT_DISPLAY }}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            onClick={handleSubmit}
            className="flex flex-[1.5] items-center justify-center gap-1.5 rounded-full px-4 py-3 text-[10.5px] font-bold uppercase text-white transition active:scale-[0.97] disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #06B6D4 0%, #3B82F6 100%)', letterSpacing: '0.9px', fontFamily: FONT_DISPLAY, boxShadow: '0 6px 20px rgba(6,182,212,0.35)' }}
          >
            {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando</> : <><Save className="h-3.5 w-3.5" /> Guardar cambios</>}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
