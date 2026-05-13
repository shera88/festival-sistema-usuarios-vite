import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Send } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { TextField, SelectField } from '@/components/forms/FormField';

const CATEGORIAS = [
  { value: 'colegios', label: 'Colegios' },
  { value: 'universidades', label: 'Universidades' },
  { value: 'agrupacion', label: 'Agrupaciones' },
];

const DIVISIONES = [
  { value: 'pre_infantil', label: 'Pre Infantil', hint: '4 a 6 años' },
  { value: 'infantil', label: 'Infantil', hint: '7 a 10 años' },
  { value: 'pre_juvenil', label: 'Pre Juvenil', hint: '11 a 13 años' },
  { value: 'juvenil', label: 'Juvenil', hint: '14 a 17 años' },
  { value: 'mayores', label: 'Mayores', hint: '18 a 35 años' },
  { value: 'adultos', label: 'Adultos', hint: '36+ años' },
];

const SUBDIVISIONES = [
  { value: 'solo', label: 'Solo', hint: '1 integrante' },
  { value: 'duo', label: 'Dúo', hint: '2 integrantes' },
  { value: 'grupo_pequeno', label: 'Grupo Chico', hint: '3 a 14' },
  { value: 'grupo_grande', label: 'Grupo Grande', hint: '15 a 60' },
];

const MODALIDADES = [
  'FOLCLORE ORIENTAL',
  'FOLCLORE ANDINO',
  'FOLCLORE DEL VALLE',
  'FOLCLORE DEL CHACO',
  'FOLCLORE LATINOAMERICANO',
  'FOLCLORE ANDINO TINKU',
  'FOLCLORE POPULAR SAYA Y CAPORAL',
  'DANZA ÉTNICA',
  'BALLET CLÁSICO Y NEOCLÁSICO',
  'JAZZ DANCE CONTEMPORÁNEO',
  'BAILES TROPICALES',
  'BAILES DE SALÓN',
  'MODALIDAD LIBRE',
  'DANZA ÁRABE O INDÚ',
  'HIP HOP',
  'COMERCIAL DANCE',
  'DANZA URBANA LIBRE',
].map((m) => ({ value: m, label: m }));

export function InscripcionPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState({
    nombre_y_apellido: user?.nombre_y_apellido ?? '',
    numero_de_carnet: user?.numero_de_carnet ?? '',
    telefono: user?.telefono ?? '',
    correo_electronico: user?.correo_electronico ?? '',
    ciudad: user?.ciudad ?? '',
    agrupacion: user?.nombre_agrupacion ?? '',
    nombre_de_la_obra: '',
    coreografo: '',
    director: '',
    categoria: '',
    division: '',
    subdivision: '',
    cantidad: '',
    modalidad: '',
  });

  function update<K extends keyof typeof data>(field: K, value: string) {
    setData((d) => ({ ...d, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    console.log('[Inscripcion] submit data:', data);
    toast.success('Datos validados. Conectar al backend pendiente.', {
      description: 'Esta es la UI del formulario — el POST a /api/inscripcion-submit se implementará en próxima iteración.',
    });
  }

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-1.5 text-[12px] text-text-45 transition hover:text-cyan"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Volver
      </button>

      <div className="rounded-2xl border border-cyan/20 bg-glass-bg p-5 backdrop-blur-md sm:p-7">
        <h1 className="mb-1 text-2xl font-semibold text-text-white">Inscripción</h1>
        <p className="mb-6 text-[13px] text-text-65">
          Inscribir una obra al festival. Datos personales prellenados desde tu cuenta.
        </p>

        <form onSubmit={handleSubmit} className="space-y-1">
          <section className="mb-6">
            <h2
              className="mb-3 text-[10px] font-semibold uppercase text-cyan"
              style={{ letterSpacing: '1.5px' }}
            >
              1 · Datos del representante
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                label="Nombre y apellido"
                required
                value={data.nombre_y_apellido}
                onChange={(e) => update('nombre_y_apellido', e.target.value)}
              />
              <TextField
                label="Carnet de identidad"
                required
                value={data.numero_de_carnet}
                readOnly
                disabled
                hint="No modificable"
              />
              <TextField
                label="Teléfono"
                required
                value={data.telefono}
                onChange={(e) => update('telefono', e.target.value)}
              />
              <TextField
                label="Correo electrónico"
                type="email"
                required
                value={data.correo_electronico}
                onChange={(e) => update('correo_electronico', e.target.value)}
              />
              <TextField
                label="Ciudad"
                required
                value={data.ciudad}
                onChange={(e) => update('ciudad', e.target.value)}
              />
            </div>
          </section>

          <section className="mb-6">
            <h2
              className="mb-3 text-[10px] font-semibold uppercase text-fuchsia"
              style={{ letterSpacing: '1.5px' }}
            >
              2 · Datos de la obra
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                label="Agrupación"
                required
                value={data.agrupacion}
                onChange={(e) => update('agrupacion', e.target.value)}
              />
              <TextField
                label="Nombre de la obra"
                required
                value={data.nombre_de_la_obra}
                onChange={(e) => update('nombre_de_la_obra', e.target.value)}
              />
              <TextField
                label="Coreógrafo"
                required
                value={data.coreografo}
                onChange={(e) => update('coreografo', e.target.value)}
              />
              <TextField
                label="Director"
                value={data.director}
                onChange={(e) => update('director', e.target.value)}
              />
              <SelectField
                label="Categoría"
                required
                value={data.categoria}
                onChange={(e) => update('categoria', e.target.value)}
                options={CATEGORIAS}
              />
              <SelectField
                label="División"
                required
                value={data.division}
                onChange={(e) => update('division', e.target.value)}
                options={DIVISIONES}
              />
              <SelectField
                label="Subdivisión"
                required
                value={data.subdivision}
                onChange={(e) => update('subdivision', e.target.value)}
                options={SUBDIVISIONES}
              />
              <TextField
                label="Cantidad de bailarines"
                type="number"
                required
                min={1}
                max={60}
                value={data.cantidad}
                onChange={(e) => update('cantidad', e.target.value)}
              />
              <div className="sm:col-span-2">
                <SelectField
                  label="Modalidad"
                  required
                  value={data.modalidad}
                  onChange={(e) => update('modalidad', e.target.value)}
                  options={MODALIDADES}
                />
              </div>
            </div>
          </section>

          <div className="flex justify-end gap-3 border-t border-glass-border pt-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="rounded-lg border border-glass-border bg-glass-bg px-5 py-2.5 text-[13px] font-medium text-text-90 transition hover:border-text-45"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-[13px] font-semibold uppercase text-white shadow-lg transition hover:opacity-95"
              style={{
                background: 'linear-gradient(135deg, var(--cyan), var(--fuchsia))',
                letterSpacing: '0.5px',
              }}
            >
              <Send className="h-4 w-4" />
              Inscribir Obra
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
