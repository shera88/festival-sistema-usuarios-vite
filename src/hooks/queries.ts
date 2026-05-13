import { useQuery } from '@tanstack/react-query';
import { dataApi } from '@/lib/api/data';
import type { Year, YearNotas } from '@/types/domain';

export function useBootstrap(enabled: boolean) {
  return useQuery({
    queryKey: ['bootstrap'],
    queryFn: () => dataApi.bootstrap(),
    enabled,
  });
}

export function useInscripciones(year: Year, enabled: boolean) {
  return useQuery({
    queryKey: ['inscripciones', year],
    queryFn: () => dataApi.inscripciones(year),
    enabled,
  });
}

export function useKardex(year: Year, enabled: boolean) {
  return useQuery({
    queryKey: ['kardex', year],
    queryFn: () => dataApi.kardex(year),
    enabled,
  });
}

export function useCalificaciones(year: YearNotas, enabled: boolean) {
  return useQuery({
    queryKey: ['calificaciones', year],
    queryFn: () => dataApi.calificaciones(year),
    enabled,
  });
}

export function useVideos(enabled: boolean) {
  return useQuery({
    queryKey: ['videos'],
    queryFn: () => dataApi.videos(),
    enabled,
  });
}

export function usePagos(year: Year, enabled: boolean) {
  return useQuery({
    queryKey: ['pagos', year],
    queryFn: () => dataApi.pagos(year),
    enabled,
  });
}
