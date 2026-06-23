import { createContext } from 'react';
import type { User } from '@/types/domain';

export interface AuthState {
  user: User | null;
  loading: boolean;
  /** true si el usuario tiene rol de representante/director/coreógrafo.
   *  Los participantes de kárdex (todos los es_* en false) son solo-lectura. */
  puedeEditar: boolean;
  login: (idContacto: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
}

export const AuthCtx = createContext<AuthState | null>(null);
