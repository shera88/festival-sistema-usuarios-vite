import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';

const WATCHED_TABLES = [
  'registro_de_inscripcion_2026',
  'registro_kardex_2026',
  'recepcion_notas_2026',
  'registro_solicitud_2026',
  'instituciones',
  'coreografos',
  'pagos_2026',
];

const INVALIDATIONS: Record<string, string[][]> = {
  registro_de_inscripcion_2026: [['inscripciones'], ['mis-agrupaciones'], ['agrupaciones']],
  registro_kardex_2026: [['kardex']],
  recepcion_notas_2026: [['calificaciones'], ['videos']],
  registro_solicitud_2026: [['solicitudes']],
  instituciones: [['mis-agrupaciones'], ['agrupaciones']],
  coreografos: [['coreografos']],
  pagos_2026: [['pagos-resumen'], ['pagos-historial'], ['pagos-anos']],
};

export function useRealtime() {
  const qc = useQueryClient();

  useEffect(() => {
    // Batch de invalidaciones: agrupa eventos rapidos en una sola ronda
    // de invalidate (debounce 500ms). Evita N re-renders por N eventos.
    const pendingKeys = new Set<string>();
    let timer: ReturnType<typeof setTimeout> | null = null;

    function flush() {
      if (pendingKeys.size === 0) return;
      for (const k of pendingKeys) {
        qc.invalidateQueries({ queryKey: k.split('|') });
      }
      pendingKeys.clear();
      timer = null;
    }

    function schedule(keys: string[][]) {
      for (const key of keys) pendingKeys.add(key.join('|'));
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, 200);
    }

    const channel = supabase.channel('app-realtime');

    for (const table of WATCHED_TABLES) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => {
          schedule(INVALIDATIONS[table] ?? []);
        },
      );
    }

    channel.subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [qc]);
}
