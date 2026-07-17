import { useQuery } from '@tanstack/react-query';
import { dataApi } from '@/lib/api/data';
import { supabase } from '@/lib/supabase/client';
import type { Year, YearNotas } from '@/types/domain';

/** Fila del ranking público en vivo (RPC anon `ranking_publico`, datos jurados). */
export type RankingObra = {
  id_inscripcion: string;
  obra: string | null;
  agrupacion: string | null;
  modalidad: string | null;
  genero: string | null;
  categoria: string | null;
  dia: string | null;
  orden: number | null;
  enlace_del_logo: string | null;
  nota_final: number | null;
  jurados: number;
};

/**
 * Ranking/calificaciones en vivo de TODO el festival (RPC anon SECURITY DEFINER
 * `ranking_publico`, compartido con la app de jurados). Refresco por polling ~8s
 * — anon no puede suscribirse por WS a la tabla base, así que se sondea (mismo
 * patrón que el ranking público de jurados).
 */
export function useRankingPublico(enabled: boolean) {
  return useQuery({
    queryKey: ['ranking-publico'],
    queryFn: async (): Promise<RankingObra[]> => {
      const { data, error } = await supabase.rpc('ranking_publico');
      if (error) throw error;
      const payload = data as { status?: string; data?: RankingObra[] } | RankingObra[] | null;
      if (Array.isArray(payload)) return payload;
      return payload?.data ?? [];
    },
    enabled,
    refetchInterval: 8000,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });
}

/** Nota pública de un jurado (con nombre + foto) — RPC `detalle_obra_publico`. */
export type NotaPublica = {
  jurado: string | null;
  jurado_foto: string | null;
  tematica: number | null;
  interpretacion: number | null;
  coreografia: number | null;
  dificultad_y_ejecucion: number | null;
  total: number | null;
  comentario: string | null;
};

export type DetalleObra = {
  obra: {
    id_inscripcion: string;
    obra: string | null;
    agrupacion: string | null;
    modalidad: string | null;
    genero: string | null;
    categoria: string | null;
    division: string | null;
    subdivision: string | null;
    dia: string | null;
    orden: number | null;
    coreografo: string | null;
    enlace_del_logo: string | null;
  } | null;
  notas: NotaPublica[];
  nota_final: number | null;
};

/**
 * Detalle de una obra del ranking público: notas por jurado ANONIMIZADAS
 * (sin nombre ni foto) + comentarios + nota final. RPC anon `detalle_obra_publico`.
 * Refresca cada ~8s mientras el modal esté abierto (id != null).
 */
export function useDetalleObra(id: string | null) {
  return useQuery({
    queryKey: ['detalle-obra', id],
    queryFn: async (): Promise<DetalleObra> => {
      const { data, error } = await supabase.rpc('detalle_obra_publico', { p_id_inscripcion: id });
      if (error) throw error;
      const payload = data as { status?: string; data?: DetalleObra } | null;
      return payload?.data ?? { obra: null, notas: [], nota_final: null };
    },
    enabled: !!id,
    refetchInterval: id ? 8000 : false,
  });
}

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
