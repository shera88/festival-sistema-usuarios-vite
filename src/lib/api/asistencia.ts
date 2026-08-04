import { supabase } from '@/lib/supabase/client';

export interface Asistencia {
  id_inscripcion: string;
  id_agrupacion: string | null;
  agrupacion: string | null;
  obra: string | null;
  dia_obra: string | null;
  orden: string | null;
  persona_nombre: string | null;
  persona_rol: string | null;
  marcada_at: string;
}

export interface MarcarResult extends Asistencia {
  ya_estaba: boolean;
}

/** Payload que viaja en el QR que genera el representante. Compacto a propósito. */
export interface QrPayload {
  i: string; // id_inscripcion
  n?: string; // persona_nombre (quien genera)
  r?: string; // persona_rol
}

export function buildQrPayload(p: QrPayload): string {
  return JSON.stringify(p);
}

export function parseQrPayload(raw: string): QrPayload | null {
  try {
    const o = JSON.parse(raw);
    if (o && typeof o.i === 'string' && o.i) return { i: o.i, n: o.n, r: o.r };
  } catch {
    /* no era JSON */
  }
  return null;
}

/**
 * Registra la asistencia. La llama el SUPER-ADMIN al escanear el QR (la hora es la
 * del escaneo). Idempotente: si ya estaba, devuelve la existente con ya_estaba=true.
 */
export async function marcarAsistencia(
  idInscripcion: string,
  personaNombre?: string | null,
  personaRol?: string | null,
): Promise<MarcarResult> {
  const { data, error } = await supabase.rpc('marcar_asistencia', {
    p_id_inscripcion: idInscripcion,
    p_persona_nombre: personaNombre ?? null,
    p_persona_rol: personaRol ?? null,
  });
  if (error) throw new Error(error.message);
  const env = data as { status: string; data?: MarcarResult; message?: string } | null;
  if (!env || env.status !== 'ok' || !env.data) {
    throw new Error(env?.message || 'No se pudo registrar la asistencia');
  }
  return env.data;
}

/** Lista de asistencias 2026 (lectura pública por RLS). Mapa por inscripción + panel en vivo. */
async function fetchAsistencias(cols: string) {
  return supabase
    .from('asistencia_2026')
    .select(cols)
    .eq('ano', 2026)
    .order('marcada_at', { ascending: false });
}

export async function listarAsistencias(): Promise<Asistencia[]> {
  const COLS = 'id_inscripcion,id_agrupacion,agrupacion,obra,dia_obra,orden,persona_nombre,persona_rol,marcada_at';
  let { data, error } = await fetchAsistencias(COLS);
  // Resiliencia: si la migración 010 (columna orden) aún no corrió, reintenta sin ella.
  if (error && /orden/i.test(error.message)) {
    ({ data, error } = await fetchAsistencias(COLS.replace(',orden', '')));
  }
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Asistencia[];
}
