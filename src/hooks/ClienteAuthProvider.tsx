import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { clientesApi, type Cliente, type Membresia } from '@/lib/api/clientes';
import { ApiError } from '@/lib/api/client';
import { ClienteCtx } from './cliente-context';

/**
 * Sesión del área de clientes. Calca a AuthProvider (un me() al montar, 401
 * silencioso → sin sesión) para que haya un solo comportamiento que mantener.
 *
 * Se monta SIEMPRE, igual que AuthProvider: es barato (una llamada que suele dar
 * 401) y permite que la misma persona tenga las dos sesiones abiertas —alguien
 * puede bailar en el festival Y haber comprado la membresía—.
 */
export function ClienteAuthProvider({ children }: { children: ReactNode }) {
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [membresia, setMembresia] = useState<Membresia | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;
    clientesApi
      .me()
      .then((res) => {
        if (cancelado) return;
        setCliente(res.cliente);
        setMembresia(res.membresia);
      })
      .catch((err) => {
        // 401 es lo normal para quien no inició sesión: no es un error que reportar.
        if (!(err instanceof ApiError && err.status === 401)) {
          console.error('clientes/me() error:', err);
        }
        if (cancelado) return;
        setCliente(null);
        setMembresia(null);
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  /**
   * Vuelve a preguntar por la membresía. La usa la pantalla de videos al volver
   * del checkout: WooCommerce devuelve al comprador apenas paga, pero quien
   * marca la membresía es n8n unos segundos después, así que al volver todavía
   * puede figurar impaga.
   */
  const refrescar = useCallback(async () => {
    try {
      const res = await clientesApi.me();
      setCliente(res.cliente);
      setMembresia(res.membresia);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setCliente(null);
        setMembresia(null);
      }
      // Cualquier otro fallo se ignora: es un refresco oportunista, y dejar la
      // pantalla como estaba es mejor que vaciarla por un error de red.
    }
  }, []);

  const registro = useCallback(async (datos: { email: string; password: string; nombre: string; telefono?: string }) => {
    const res = await clientesApi.registro(datos);
    setCliente(res.cliente);
    setMembresia(res.membresia);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await clientesApi.login(email, password);
    setCliente(res.cliente);
    setMembresia(res.membresia);
  }, []);

  const logout = useCallback(async () => {
    try {
      await clientesApi.logout();
    } finally {
      // Se limpia pase lo que pase: si falla la llamada, dejar la pantalla como
      // si siguiera con sesión es peor que cerrarla de más.
      setCliente(null);
      setMembresia(null);
    }
  }, []);

  return (
    <ClienteCtx.Provider value={{ cliente, membresia, loading, registro, login, logout, refrescar }}>
      {children}
    </ClienteCtx.Provider>
  );
}
