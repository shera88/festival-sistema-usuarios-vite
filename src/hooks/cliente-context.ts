import { createContext } from 'react';
import type { Cliente, Membresia } from '@/lib/api/clientes';

/**
 * Sesión del área de CLIENTES. Deliberadamente separada de AuthCtx: mezclarlas
 * obligaría a cada vista a preguntar "¿y este quién es?", y la primera que se
 * olvide de preguntar deja pasar a quien no debe.
 */
export interface ClienteState {
  cliente: Cliente | null;
  /** Se relee del servidor en cada me(): el pago lo acredita n8n por fuera, así
   *  que un valor cacheado dejaría al comprador viendo "no pagado". */
  membresia: Membresia | null;
  loading: boolean;
  registro: (datos: { email: string; password: string; nombre: string; telefono?: string }) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refrescar: () => Promise<void>;
}

export const ClienteCtx = createContext<ClienteState | null>(null);
