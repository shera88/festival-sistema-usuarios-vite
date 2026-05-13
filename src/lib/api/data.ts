import { api } from './client';
import type { Bootstrap, Inscripcion, KardexRow, Nota, VideoItem, Year, YearNotas } from '@/types/domain';

export const dataApi = {
  bootstrap: () => api.get<Bootstrap>('/bootstrap.php'),

  inscripciones: (year: Year) =>
    api.get<Record<string, Inscripcion[]>>(`/inscripciones.php?year=${year}`),

  kardex: (year: Year) =>
    api.get<Record<string, KardexRow[]>>(`/kardex.php?year=${year}`),

  calificaciones: (year: YearNotas) =>
    api.get<Record<string, Nota[]>>(`/calificaciones.php?year=${year}`),

  videos: () =>
    api.get<Record<string, VideoItem[]>>('/videos.php'),

  pagos: (year: Year) =>
    api.get<Record<string, unknown[]>>(`/pagos.php?year=${year}`),
};
