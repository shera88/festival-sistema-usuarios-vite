import { useQuery } from '@tanstack/react-query';
import { medirDuracionAudio } from '@/lib/duracion-audio';

/**
 * Duración real del audio de esa URL, en segundos (null mientras se mide o si
 * el archivo no se pudo leer).
 *
 * Se apoya en react-query para que el archivo se mida UNA sola vez: si la misma
 * obra aparece en varias vistas, o se vuelve a la pestaña, se reutiliza el valor
 * ya conocido en lugar de volver a pedir los metadatos.
 */
export function useDuracionAudio(url: string | null | undefined): number | null {
  const { data } = useQuery({
    queryKey: ['duracion-audio', url],
    queryFn: () => medirDuracionAudio(String(url)),
    enabled: !!url,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
  });
  return data ?? null;
}
