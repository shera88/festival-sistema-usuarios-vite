import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import type { CoreografoSearchResult } from "./types";

const MIN_QUERY = 2;

/**
 * Busqueda de coreografos por nombre. Misma logica que useSearchAgrupaciones:
 * accent-insensitive via translate() en la RPC, debounce a cargo del componente.
 */
export function useSearchCoreografos(q: string) {
  const trimmed = q.trim();
  return useQuery({
    queryKey: ["coreografos", "search", trimmed],
    queryFn: async (): Promise<CoreografoSearchResult[]> => {
      const { data, error } = await supabase.rpc("search_coreografos", {
        q: trimmed,
      });
      if (error) throw error;
      return (data as CoreografoSearchResult[] | null) ?? [];
    },
    enabled: trimmed.length >= MIN_QUERY,
    staleTime: 30_000,
  });
}
