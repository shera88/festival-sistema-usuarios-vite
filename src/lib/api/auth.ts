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
};
