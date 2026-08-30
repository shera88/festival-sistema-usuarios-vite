import { useQuery } from '@tanstack/react-query';
import { clientesApi } from '@/lib/api/clientes';

/**
 * Consultas del área de clientes.
 *
 * En archivo aparte de hooks/queries.ts a propósito: ese lo comparten todas las
 * pantallas del portal y no hace falta engordarlo con algo que sólo usa el área
 * de clientes.
 *
 * Las claves de cache llevan el prefijo 'cliente' para no chocar con las del
 * portal. Sin eso, `['videos']` sería la misma entrada para dos respuestas
 * distintas: una persona que fuera participante Y cliente vería los videos del
 * otro lado según cuál cargó primero.
 */

export function useVideosCliente(habilitado: boolean) {
  return useQuery({
    queryKey: ['cliente', 'videos'],
    queryFn: () => clientesApi.videos(),
    enabled: habilitado,
  });
}

export function useNominadosCliente(habilitado: boolean) {
  return useQuery({
    queryKey: ['cliente', 'nominados'],
    queryFn: () => clientesApi.nominados(),
    enabled: habilitado,
  });
}

export function useGanadoresCliente(habilitado: boolean) {
  return useQuery({
    queryKey: ['cliente', 'ganadores'],
    queryFn: () => clientesApi.ganadores(),
    enabled: habilitado,
  });
}
