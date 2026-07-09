import { api } from './client';
import type { User, SearchResult } from '@/types/domain';

export interface LoginResponse {
  user: User;
}

export const authApi = {
  searchParticipants: (q: string) =>
    api.get<SearchResult[]>(`/search-participants.php?q=${encodeURIComponent(q)}`),

  login: (idContacto: string, password: string) =>
    api.post<LoginResponse>('/login.php', { id_contacto: idContacto, password }),

  logout: () => api.post<{ ok: true }>('/logout.php', {}),

  me: () => api.get<LoginResponse>('/me.php'),

  /** Supervisión (solo super admin): entra al panel de otra persona. */
  impersonar: (idContacto: string) =>
    api.post<{ ok: true; user: User }>('/impersonar.php', { id_contacto: idContacto }),

  /** Vuelve a la cuenta real del super admin. */
  stopImpersonar: () => api.post<{ ok: true; user: User }>('/impersonar.php', { stop: true }),
};
