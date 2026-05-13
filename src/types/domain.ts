export interface User {
  id_contacto: string;
  numero_de_carnet: string | null;
  nombre_y_apellido: string;
  telefono: string | null;
  correo_electronico: string | null;
  ciudad: string | null;
  imagen_contacto: string | null;
  id_agrupacion: string | null;
  nombre_agrupacion: string | null;
  enlace_del_logo: string | null;
  rol_primario: string | null;
  es_representante: boolean;
  es_director: boolean;
  es_coreografo: boolean;
  id_original_representante: string | null;
  id_original_director: string | null;
  id_original_coreografo: string | null;
}

export interface SearchResult {
  id: string;
  id_contacto: string;
  nombre: string;
  carnet: string | null;
  telefono: string | null;
  email: string | null;
  ciudad: string | null;
  rol: string | null;
  foto: string | null;
  id_agrupacion: string | null;
  nombre_agrupacion: string | null;
  enlace_del_logo: string | null;
  es_representante: boolean;
  es_director: boolean;
  es_coreografo: boolean;
  id_original_representante: string | null;
  id_original_director: string | null;
  id_original_coreografo: string | null;
}

export interface Inscripcion {
  id_inscripcion: string;
  orden: number | string | null;
  dia: string | null;
  agrupacion: string | null;
  id_agrupacion: string | null;
  enlace_del_logo: string | null;
  nombre_de_la_obra: string | null;
  categoria: string | null;
  division: string | null;
  subdivision: string | null;
  modalidad: string | null;
  genero: string | null;
  bloque: string | null;
  coreografo: string | null;
  director: string | null;
  cantidad: string | number | null;
  duracion: string | null;
  estado: string | null;
  formato_de_inscripcion: string | null;
  musica: string | null;
  informe: string | null;
  indicaciones: string | null;
  url_video: string | null;
}

export interface KardexRow {
  nombre_y_apellido: string | null;
  cargo: string | null;
  foto: string | null;
  agrupacion: string | null;
  enlace_del_logo: string | null;
  telefono: string | null;
  correo_electronico: string | null;
  ci: string | null;
  ciudad: string | null;
  edad: string | number | null;
  estado: string | null;
  enlace_del_credencial: string | null;
  enlace_del_certificado: string | null;
}

export interface Nota {
  id_inscripcion: string;
  id_jurado: string | null;
  jurado: string | null;
  jurado_foto: string | null;
  jurado_nombre: string | null;
  jurado_generos: string | null;
  inst_logo: string | null;
  inst_nombre: string | null;
  insc_dia: string | null;
  insc_orden: number | string | null;
  insc_obra: string | null;
  agrupacion: string | null;
  dia: string | null;
  orden: number | string | null;
  tematica: number | string | null;
  interpretacion: number | string | null;
  coreografia: number | string | null;
  dificultad_y_ejecucion: number | string | null;
  comentario: string | null;
}

export interface VideoItem {
  id_inscripcion: string;
  orden: number | string | null;
  dia: string | null;
  agrupacion: string | null;
  enlace_del_logo: string | null;
  nombre_de_la_obra: string | null;
  url_video: string | null;
  categoria: string | null;
  division: string | null;
  subdivision: string | null;
  modalidad: string | null;
  coreografo: string | null;
  director: string | null;
  bloque: string | null;
  genero: string | null;
}

export interface Institucion {
  id_agrupacion: string;
  nombre_agrupacion: string | null;
  enlace_del_logo: string | null;
  ciudad: string | null;
  [k: string]: unknown;
}

export type LogosMap = Record<string, string>;

export interface Bootstrap {
  user: User;
  institucion: Institucion | null;
  logosMap: LogosMap;
}

export type Year = '2023' | '2024' | '2025' | '2026';
export type YearNotas = '2023' | '2024' | '2025';
