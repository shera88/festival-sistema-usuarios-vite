import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Send } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { TextField } from '@/components/forms/FormField';

export function KardexFormPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState({
    agrupacion: user?.nombre_agrupacion ?? '',
    representante: user?.nombre_y_apellido ?? '',
    carnet_representante: user?.numero_de_carnet ?? '',
    telefono_representante: user?.telefono ?? '',
    nombre_integrante: '',
    cargo: '',
    ci_integrante: '',
    telefono_integrante: '',
    edad: '',
    ciudad: '',
    correo_integrante: '',
  });

  function update<K extends keyof typeof data>(field: K, value: string) {
    setData((d) => ({ ...d, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    console.log('[Kardex] submit:', data);
    toast.success('Datos validados. Backend POST pendiente.', {
      description: 'UI lista — endpoint /api/kardex-submit en próxima iteración.',
    });
  }

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-1.5 text-[12px] text-text-45 transition hover:text-fuchsia"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Volver
      </button>

      <div className="rounded-2xl border border-fuchsia/20 bg-glass-bg p-5 backdrop-blur-md sm:p-7">
        <h1 className="mb-1 text-2xl font-semibold text-text-white">Kardex</h1>
        <p className="mb-6 text-[13px] text-text-65">
          Registrar un integrante del kardex de tu agrupación.
        </p>

        <form onSubmit={handleSubmit} className="space-y-1">
          <section className="mb-6">
            <h2
              className="mb-3 text-[10px] font-semibold uppercase text-fuchsia"
              style={{ letterSpacing: '1.5px' }}
            >
              1 · Tu información (representante)
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                label="Agrupación"
                value={data.agrupacion}
                onChange={(e) => update('agrupacion', e.target.value)}
              />
              <TextField
                label="Representante"
                value={data.representante}
                readOnly
                disabled
                hint="Auto (tu cuenta)"
              />
              <TextField
                label="Carnet representante"
                value={data.carnet_representante}
                readOnly
                disabled
                hint="No modificable"
              />
              <TextField
                label="Teléfono representante"
                value={data.telefono_representante}
                onChange={(e) => update('telefono_representante', e.target.value)}
              />
            </div>
          </section>

          <section className="mb-6">
            <h2
              className="mb-3 text-[10px] font-semibold uppercase text-cyan"
              style={{ letterSpacing: '1.5px' }}
            >
              2 · Datos del integrante
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                label="Nombre y apellido"
                required
                value={data.nombre_integrante}
                onChange={(e) => update('nombre_integrante', e.target.value)}
              />
              <TextField
                label="Cargo / rol"
                required
                value={data.cargo}
                onChange={(e) => update('cargo', e.target.value)}
                placeholder="Bailarín / Director / Coreógrafo..."
              />
              <TextField
                label="Carnet de identidad"
                required
                value={data.ci_integrante}
                onChange={(e) => update('ci_integrante', e.target.value)}
              />
              <TextField
                label="Teléfono"
                value={data.telefono_integrante}
                onChange={(e) => update('telefono_integrante', e.target.value)}
              />
              <TextField
                label="Edad"
                type="number"
                value={data.edad}
                onChange={(e) => update('edad', e.target.value)}
              />
              <TextField
                label="Ciudad"
                value={data.ciudad}
                onChange={(e) => update('ciudad', e.target.value)}
              />
              <div className="sm:col-span-2">
                <TextField
                  label="Correo electrónico"
                  type="email"
                  value={data.correo_integrante}
                  onChange={(e) => update('correo_integrante', e.target.value)}
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
                background: 'linear-gradient(135deg, var(--fuchsia), var(--cyan))',
                letterSpacing: '0.5px',
              }}
            >
              <Send className="h-4 w-4" />
              Registrar Integrante
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
