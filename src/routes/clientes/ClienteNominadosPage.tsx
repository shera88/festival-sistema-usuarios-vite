import { useCliente } from '@/hooks/useCliente';
import { useNominadosCliente } from '@/hooks/queries-clientes';
import { NominadosView } from '@/components/resultados/NominadosView';

/**
 * Nominados para clientes. Misma vista que ve el participante: la lista va
 * mezclada y sin el lugar, así que no hay nada que recortar. Sale del mismo
 * endpoint (nominados.php acepta las dos sesiones).
 */
export function ClienteNominadosPage() {
  const { cliente } = useCliente();
  const { data, isLoading, error } = useNominadosCliente(!!cliente);

  return (
    <NominadosView
      bloques={data?.bloques ?? []}
      total={data?.total ?? 0}
      ano={data?.ano ?? '2026'}
      cargando={isLoading}
      error={!!error}
    />
  );
}
