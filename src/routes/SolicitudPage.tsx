import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Send } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { TextField, TextareaField } from '@/components/forms/FormField';

export function SolicitudPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState({
    nombre_y_apellido: user?.nombre_y_apellido ?? '',
    numero_de_carnet: user?.numero_de_carnet ?? '',
    telefono: user?.telefono ?? '',
    correo_electronico: user?.correo_electronico ?? '',
    ciudad: user?.ciudad ?? '',
    agrupacion: user?.nombre_agrupacion ?? '',
    motivo: '',
    comentarios: '',
  });

  function update<K extends keyof typeof data>(field: K, value: string) {
    setData((d) => ({ ...d, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    console.log('[Solicitud] submit:', data);
    toast.success('Datos validados. Backend POST pendiente.', {
      description: 'UI lista — endpoint /api/solicitud-submit en próxima iteración.',
    });
  }

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-1.5 text-[12px] text-text-45 transition hover:text-gold"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Volver
      </button>

      <div className="rounded-2xl border border-gold/20 bg-glass-bg p-5 backdrop-blur-md sm:p-7">
        <h1 className="mb-1 text-2xl font-semibold text-text-white">Solicitud</h1>
        <p className="mb-6 text-[13px] text-text-65">
          Solicitar participación en el festival. Datos prellenados desde tu cuenta.
        </p>

        <form onSubmit={handleSubmit} className="space-y-1">
          <section className="mb-6">
            <h2
              className="mb-3 text-[10px] font-semibold uppercase text-gold"
              style={{ letterSpacing: '1.5px' }}
            >
              Datos del solicitante
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
              <TextField
                label="Agrupación"
                value={data.agrupacion}
                onChange={(e) => update('agrupacion', e.target.value)}
              />
              <div className="sm:col-span-2">
                <TextField
                  label="Motivo de la solicitud"
                  required
                  value={data.motivo}
                  onChange={(e) => update('motivo', e.target.value)}
                  placeholder="Ej. Inscripción tardía, cambio de modalidad..."
                />
              </div>
              <div className="sm:col-span-2">
                <TextareaField
                  label="Comentarios adicionales"
                  value={data.comentarios}
                  onChange={(e) => update('comentarios', e.target.value)}
                  rows={5}
                  placeholder="Detalles, contexto, fechas..."
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
                background: 'linear-gradient(135deg, var(--gold), var(--fuchsia))',
                letterSpacing: '0.5px',
              }}
            >
              <Send className="h-4 w-4" />
              Enviar Solicitud
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
