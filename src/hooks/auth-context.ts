import { createContext } from 'react';
import type { User } from '@/types/domain';

export interface AuthState {
  user: User | null;
  loading: boolean;
  login: (idContacto: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthCtx = createContext<AuthState | null>(null);
