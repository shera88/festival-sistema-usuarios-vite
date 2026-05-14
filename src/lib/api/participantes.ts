import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import type {
  ParticipanteSearchResult,
  ParticipanteDetalle,
} from "./types";

const MIN_QUERY = 2;

/**
 * Búsqueda de contactos en `festival_contactos_global` por nombre.
 * Solo devuelve id_contacto (uuid) + nombre — sin PII.
 */
export function useSearchParticipantes(q: string) {
  const trimmed = q.trim();
  return useQuery({
    queryKey: ["participantes", "search", trimmed],
    queryFn: async (): Promise<ParticipanteSearchResult[]> => {
      const { data, error } = await supabase.rpc("search_participantes", {
        q: trimmed,
      });
      if (error) throw error;
      return (data as ParticipanteSearchResult[] | null) ?? [];
    },
    enabled: trimmed.length >= MIN_QUERY,
    staleTime: 30_000,
  });
}

/**
 * Detalle de un contacto con PII (CI, teléfono, email, ciudad), usado para
 * comparación al envío del formulario (warning de tel/CI distinto al
 * registrado). NO se usa para auto-fill — los campos se mantienen vacíos
 * en la UI por privacidad. Solo dispara con un id válido (uuid).
 */
export function useParticipante(id: string | null | undefined) {
  return useQuery({
    queryKey: ["participantes", "detalle", id],
    queryFn: async (): Promise<ParticipanteDetalle | null> => {
      if (!id) return null;
      const { data, error } = await supabase.rpc(
        "obtener_contacto_por_id",
        { p_id: id },
      );
      if (error) throw error;
      const arr = data as ParticipanteDetalle[] | null;
      return arr && arr.length > 0 ? arr[0] : null;
    },
    enabled: !!id && id.trim().length >= 3,
    staleTime: 60_000,
  });
}
