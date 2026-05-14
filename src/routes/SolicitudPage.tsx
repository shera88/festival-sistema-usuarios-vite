import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { SolicitudForm } from '@/components/solicitud/SolicitudForm';

export function SolicitudPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const defaultValues = useMemo(
    () => ({
      nombre_y_apellido: user?.nombre_y_apellido ?? '',
      id_contacto: user?.id_contacto ?? '',
      numero_de_carnet: user?.numero_de_carnet ?? '',
      agrupacion: user?.nombre_agrupacion ?? '',
      id_agrupacion: user?.id_agrupacion ?? '',
      ciudad: user?.ciudad ?? '',
      telefono: user?.telefono ?? '',
      correo_electronico: user?.correo_electronico ?? '',
      genero: [],
      categoria: [],
      division: [],
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
            Solicitud
          </span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-text-65">
          Primer contacto con el festival. Datos prellenados desde su cuenta. Modifique lo
          necesario o busque a otra persona para registrarla.
        </p>
      </div>

      <SolicitudForm defaultValues={defaultValues} />
    </div>
  );
}
