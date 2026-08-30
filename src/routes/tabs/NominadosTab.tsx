import { useNominados } from '@/hooks/queries';
import { NominadosView } from '@/components/resultados/NominadosView';

/**
 * Nominados en el portal de PARTICIPANTES.
 *
 * El contenedor sólo trae los datos; todo lo que se ve vive en NominadosView,
 * que comparte con el área de clientes. Antes esta pantalla tenía el JSX propio;
 * se extrajo para que las dos entradas no se separen con el tiempo.
 *
 * ABIERTA A TODO EL PORTAL (2026-08-24). No hace falta guarda de rol aquí porque
 * la respuesta no trae nada reservado —el lugar y la nota se esconden a
 * propósito— y el backend igual exige sesión, que es donde vive la protección
 * real.
 */
export function NominadosTab() {
  const { data, isLoading, error } = useNominados(true);

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
