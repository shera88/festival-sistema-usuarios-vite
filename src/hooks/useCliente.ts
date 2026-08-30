import { useContext } from 'react';
import { ClienteCtx } from './cliente-context';

export function useCliente() {
  const ctx = useContext(ClienteCtx);
  if (!ctx) throw new Error('useCliente debe usarse dentro de ClienteAuthProvider');
  return ctx;
}
