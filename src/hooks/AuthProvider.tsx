import { useEffect, useState, type ReactNode } from 'react';
import { authApi } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import type { User } from '@/types/domain';
import { AuthCtx } from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    authApi
      .me()
      .then((res) => {
        if (!cancelled) setUser(res.user);
      })
      .catch((err) => {
        if (!(err instanceof ApiError && err.status === 401)) {
          console.error('me() error:', err);
        }
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function login(idContacto: string, password: string) {
    const res = await authApi.login(idContacto, password);
    setUser(res.user);
  }

  async function logout() {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
    }
  }

  // Editan: contactos de festival_contactos_global y participantes kárdex
  // STAFF/DIRECTOR/COREOGRAFO. validate_login ya resolvió `puede_editar`.
  // Default true para sesiones legacy (solo contactos existían antes).
  const puedeEditar = user ? (user.puede_editar ?? true) : false;

  return <AuthCtx.Provider value={{ user, loading, puedeEditar, login, logout, setUser }}>{children}</AuthCtx.Provider>;
}
