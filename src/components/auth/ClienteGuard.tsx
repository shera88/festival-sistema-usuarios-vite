import { Navigate, useLocation } from 'react-router-dom';
import { useCliente } from '@/hooks/useCliente';
import type { ReactNode } from 'react';

/**
 * Deja pasar sólo a una sesión de CLIENTE.
 *
 * Equivalente de AuthGuard pero contra el otro realm: una sesión de participante
 * NO abre esta puerta, igual que una de cliente no abre la del portal. El
 * servidor ya lo impone (`requireCliente()`); esto es para que el navegante vea
 * la pantalla correcta, no la única cerradura.
 */
export function ClienteGuard({ children }: { children: ReactNode }) {
  const { cliente, loading } = useCliente();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-text-45">Cargando...</div>
      </div>
    );
  }

  if (!cliente) {
    return <Navigate to="/clientes/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
