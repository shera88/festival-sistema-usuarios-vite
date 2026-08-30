import { useEffect } from 'react';
import { Crown } from 'lucide-react';
import { useCliente } from '@/hooks/useCliente';
import { useGanadoresCliente } from '@/hooks/queries-clientes';
import { GanadoresView } from '@/components/resultados/GanadoresView';
import { ApiError } from '@/lib/api/client';

/**
 * Ganadores para clientes.
 *
 * Mientras la organización no habilite los resultados, el servidor responde
 * `publicado: false` y aquí se muestra el aviso. No es un error ni una falta de
 * permisos: los resultados todavía no salieron.
 *
 * El desglose por jurado va apagado (`verDetalle={false}`): ese endpoint es de
 * super admin y un cliente no tiene por qué abrirlo.
 */
export function ClienteGanadoresPage() {
  const { cliente, refrescar } = useCliente();
  const { data, isLoading, error } = useGanadoresCliente(!!cliente);

  // Si la sesión venció, refrescar() deja el cliente en null y ClienteGuard
  // manda al login. Sin esto la pantalla se quedaba con un error para siempre:
  // la sesión estaba muerta pero la app seguía creyendo que había una.
  const sesionVencida = error instanceof ApiError && error.status === 401;
  useEffect(() => {
    if (sesionVencida) void refrescar();
  }, [sesionVencida, refrescar]);

  const publicado = data?.publicado === true;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-[12px] text-text-45">
        Cargando…
      </div>
    );
  }

  // Se muestra el mismo aviso ante un fallo de red que cuando el servidor dice
  // que todavía no se publicó. Para quien mira la pantalla el hecho es el mismo
  // —los resultados no están— y «no se pudieron cargar» sólo asusta sin que
  // haya nada que la persona pueda hacer al respecto.
  if (!publicado) {
    return (
      <section className="mx-auto mt-10 w-full max-w-lg rounded-xl border border-glass-border bg-glass-bg px-4 py-8 text-center">
        <Crown className="mx-auto h-8 w-8" style={{ color: 'var(--gold)' }} />
        <h1 className="mt-3 text-[15px] font-bold text-text-90">
          Los ganadores estarán disponibles después de la premiación
        </h1>
        <p className="mt-2 text-[12px] text-text-45">
          Aquí podrá ver los resultados del XVIII Festival Danzarte 2026 apenas termine la
          ceremonia de premiación.
        </p>
      </section>
    );
  }

  return (
    <GanadoresView
      bloques={data?.bloques ?? []}
      cuadros={data?.absolutos ?? []}
      total={data?.total ?? 0}
      verDetalle={false}
    />
  );
}
