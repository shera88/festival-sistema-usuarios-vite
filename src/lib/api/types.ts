/**
 * Tipos compartidos para los RPCs publicos del cliente.
 * Mapean 1:1 con las firmas en migrations/022_rpcs_festival_contactos.sql.
 *
 * Post-refactor 2026-04-30: la tabla origen es `festival_contactos_global`
 * (PK uuid id_contacto). Antes era `contactos_global` (legacy text id_global).
 */

export type AgrupacionInscrita = {
  id_agrupacion: string;
  nombre_agrupacion: string;
  ciudad: string | null;
  enlace_del_logo: string | null;
};

export type AgrupacionDetalle = AgrupacionInscrita;

export type CoreografoSearchResult = {
  id_coreografo: string;
  coreografo: string;
};

export type ParticipanteSearchResult = {
  id_contacto: string;
  nombre_y_apellido: string;
};

export type ParticipanteDetalle = {
  id_contacto: string;
  nombre_y_apellido: string;
  numero_de_carnet: string | null;
  telefono: string | null;
  ciudad: string | null;
  correo_electronico: string | null;
};
