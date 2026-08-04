import { useQuery } from '@tanstack/react-query';
import { listarAsistencias, type Asistencia } from '@/lib/api/asistencia';

/**
 * Asistencias 2026. La key ['asistencias'] la invalida useRealtime cuando cambia
 * asistencia_2026, así el mapa por inscripción y el panel del super-admin se
 * actualizan en tiempo real.
 */
export function useAsistencias(enabled = true) {
  return useQuery<Asistencia[]>({
    queryKey: ['asistencias'],
    queryFn: listarAsistencias,
    enabled,
    staleTime: 10_000,
  });
}
