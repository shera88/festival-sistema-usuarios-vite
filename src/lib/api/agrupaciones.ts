import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import type { AgrupacionInscrita, AgrupacionDetalle } from "./types";

const MIN_QUERY = 2;

/**
 * Lista completa de agrupaciones inscritas al festival 2026.
 * El cliente la pide una vez al montar y filtra localmente con un buscador
 * — no es necesario debounce ni paginacion (son ~decenas de filas).
 */
export function useAgrupacionesInscritas() {
  return useQuery({
    queryKey: ["agrupaciones", "inscritas"],
    queryFn: async (): Promise<AgrupacionInscrita[]> => {
      const { data, error } = await supabase.rpc(
        "listar_agrupaciones_inscritas",
      );
      if (error) throw error;
      return (data as AgrupacionInscrita[] | null) ?? [];
    },
    staleTime: 60_000,
  });
}

/**
 * Busqueda accent-insensitive contra el catalogo de instituciones.
 * Solo dispara cuando q tiene al menos MIN_QUERY caracteres no vacios;
 * el componente debe encargarse de su debounce si lo necesita.
 */
export function useSearchAgrupaciones(q: string) {
  const trimmed = q.trim();
  return useQuery({
    queryKey: ["agrupaciones", "search", trimmed],
    queryFn: async (): Promise<AgrupacionInscrita[]> => {
      const { data, error } = await supabase.rpc("search_agrupaciones", {
        q: trimmed,
      });
      if (error) throw error;
      return (data as AgrupacionInscrita[] | null) ?? [];
    },
    enabled: trimmed.length >= MIN_QUERY,
    staleTime: 30_000,
  });
}

/**
 * Detalle de una agrupacion por id, para auto-fill en pickers.
 * Devuelve null si el id no se encuentra; el componente debe distinguir
 * "no encontrado" de "no consultado todavia" via isFetched/isPending.
 */
export function useAgrupacion(id: string | null | undefined) {
  return useQuery({
    queryKey: ["agrupaciones", "detalle", id],
    queryFn: async (): Promise<AgrupacionDetalle | null> => {
      if (!id) return null;
      const { data, error } = await supabase.rpc(
        "obtener_agrupacion_por_id",
        { p_id: id },
      );
      if (error) throw error;
      const arr = data as AgrupacionDetalle[] | null;
      return arr && arr.length > 0 ? arr[0] : null;
    },
    enabled: !!id && id.trim().length >= 3,
    staleTime: 60_000,
  });
}
