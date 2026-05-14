import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { KardexForm } from '@/components/kardex/KardexForm';

export function KardexFormPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const defaultValues = useMemo(
    () => ({
      agrupacion: user?.nombre_agrupacion ?? '',
      id_agrupacion: (user?.id_agrupacion ?? '').split(',')[0] ?? '',
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
            Kárdex
          </span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-text-65">
          Complete los datos de la persona a acreditar (coreógrafo, bailarín, director, staff,
          auspiciador, jurado u organización). Incluya una fotografía clara para imprimir en la
          credencial.
        </p>
      </div>

      <KardexForm defaultValues={defaultValues} />
    </div>
  );
}
