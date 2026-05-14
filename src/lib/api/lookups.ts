import { api } from './client';

export interface PersonaLite {
  id_contacto: string;
  nombre_y_apellido: string;
  foto_url?: string | null;
}

export interface PersonaDetalle extends PersonaLite {
  numero_de_carnet?: number | string | null;
  telefono?: number | string | null;
  ciudad?: string | null;
  correo_electronico?: string | null;
}

export interface AgrupacionLite {
  id_agrupacion: string;
  nombre_agrupacion: string;
  ciudad?: string | null;
  enlace_del_logo?: string | null;
  count?: number;
  years?: string[];
  last_year?: string | null;
}

export interface CoreografoLite {
  id_coreografo: string;
  nombre_y_apellido: string;
  id_agrupacion?: string | null;
  count?: number;
  last_year?: string | null;
  from_agrupacion?: boolean;
}

export const lookups = {
  personas: (q: string) =>
    api.get<PersonaLite[]>(`/search-personas.php?q=${encodeURIComponent(q)}`),
  personaDetalle: (id: string) =>
    api.get<PersonaDetalle | null>(`/persona-detalle.php?id=${encodeURIComponent(id)}`),
  coreografos: (q: string) =>
    api.get<CoreografoLite[]>(`/search-coreografos.php?q=${encodeURIComponent(q)}`),
  agrupaciones: (q: string) =>
    api.get<AgrupacionLite[]>(`/search-agrupaciones.php?q=${encodeURIComponent(q)}`),
  agrupacionesInscritas: () =>
    api.get<AgrupacionLite[]>('/agrupaciones-inscritas.php'),
  agrupacionDetalle: (id: string) =>
    api.get<AgrupacionLite | null>(`/agrupacion-detalle.php?id=${encodeURIComponent(id)}`),
  misAgrupaciones: () => api.get<AgrupacionLite[]>('/mis-agrupaciones.php'),
  agrupacionesDePersona: (idContacto: string) =>
    api.get<AgrupacionLite[]>(`/agrupaciones-de-persona.php?id_contacto=${encodeURIComponent(idContacto)}`),
  coreografosDisponibles: (params: { idAgrupacion?: string; q?: string }) => {
    const qs = new URLSearchParams();
    if (params.idAgrupacion) qs.set('id_agrupacion', params.idAgrupacion);
    if (params.q) qs.set('q', params.q);
    return api.get<CoreografoLite[]>(`/coreografos-disponibles.php?${qs}`);
  },
};
