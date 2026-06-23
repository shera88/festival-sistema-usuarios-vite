/**
 * fetch con timeout (AbortController). Sin esto, si el POST se estanca (subida
 * de archivo en red móvil débil, o backend lento), el fetch nunca resuelve y el
 * botón queda colgado en "Enviando…" para siempre. Con timeout, aborta, lanza un
 * error legible y el `finally` del form reactiva el botón para reintentar.
 *
 * 60s: cubre subidas legítimas (logo/foto + backend) sin esperar indefinidamente.
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 60000,
): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error(
        "El envío tardó demasiado (conexión lenta o inestable). Verifique su internet y reintente.",
      );
    }
    throw e;
  } finally {
    clearTimeout(t);
  }
}
