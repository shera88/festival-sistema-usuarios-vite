import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { InscripcionForm } from '@/components/inscripcion/InscripcionForm';

export function InscripcionPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const step1Defaults = useMemo(
    () => ({
      nombre_y_apellido: user?.nombre_y_apellido ?? '',
      id_contacto: user?.id_contacto ?? '',
      numero_de_carnet: user?.numero_de_carnet ?? '',
      telefono: user?.telefono ?? '',
      ciudad: user?.ciudad ?? '',
      correo_electronico: user?.correo_electronico ?? '',
      foto_url_actual: user?.imagen_contacto ?? '',
    }),
    [user],
  );

  return (
    <div className="mx-auto max-w-[900px] p-4 sm:p-8">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-5 inline-flex items-center gap-1.5 text-[12px] text-text-45 transition hover:text-text-90"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Volver
      </button>

      <div className="mb-10 text-center">
        <h1 className="whitespace-nowrap text-xl font-bold tracking-tight md:text-4xl">
          Registro de{' '}
          <span
            className="bg-clip-text font-extrabold text-transparent"
            style={{
              backgroundImage: 'linear-gradient(135deg, var(--cyan), var(--fuchsia))',
            }}
          >
            Inscripción
          </span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-text-65">
          Datos del representante, agrupación y obra a presentar en el XVIII Festival Danzarte.
          Dos pasos: info personal y luego los detalles de la obra.
        </p>
      </div>

      <InscripcionForm step1Defaults={step1Defaults} lockCarnet />
    </div>
  );
}
