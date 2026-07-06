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
  /** 'contacto' = festival_contactos_global · 'kardex' = solo registro_kardex_2026 */
  origen?: 'contacto' | 'kardex' | string;
  /** Permiso de edición resuelto en validate_login (contacto, o kárdex STAFF/DIRECTOR/COREOGRAFO). */
  puede_editar?: boolean;
  /** True si el id_contacto está en admin_usuarios.activo (resuelto on-demand en me.php). */
  es_admin?: boolean;
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
  estado_credenciales: string | null;
  multimedia_confirmado?: boolean | null;
  audio_url_multimedia?: string | null;
  video_led_url_multimedia?: string | null;
}

export interface MultimediaArchivo {
  id_multimedia: string;
  id_institucion: string;
  id_inscripcion: string | null;
  year: number;
  tipo: 'audio' | 'video_led';
  nombre_archivo: string | null;
  extension: string;
  mime_type: string | null;
  peso_bytes: number;
  storage_path: string;
  url_publica: string;
  uploaded_by: string | null;
  created_at: string;
  updated_at?: string;
}

export interface MultimediaListaRes {
  archivos: MultimediaArchivo[];
  confirmado: boolean;
  fecha_confirmacion: string | null;
}

export interface KardexRow {
  id_kardex?: string | null;
  id_agrupacion?: string | null;
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
  verificado?: boolean | null;
  /** Bailes/obras de la agrupación en los que participa (jsonb `bailes`). */
  bailes?: { id_inscripcion: string; nombre_de_la_obra: string }[] | null;
  /** Lista de id_inscripcion de esos bailes (jsonb `bailes_ids`). */
  bailes_ids?: string[] | null;
  /** Membresías (para etiqueta junto al nombre). reserva = marcó en el kárdex; pagada = ya pagó. */
  membresia?: boolean | null;
  membresia_pagada?: boolean | null;
  membresia_paquete?: boolean | null;
  membresia_paquete_pagada?: boolean | null;
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
  /** Videos 2026: true si la membresía aún no está pagada (bloqueado). */
  bloqueado?: boolean;
}

/** Estado de las membresías de la persona logueada (para gating de videos 2026). */
export interface MembresiaEstado {
  id_kardex: string | null;
  /** Reservó la membresía de Videos en el kárdex → precio 20. */
  reservo: boolean;
  /** Pagó la membresía de Videos → SUS videos 2026 desbloqueados. */
  pagada: boolean;
  /** Reservó el Paquete Completo en el kárdex → precio 40. */
  paquete_reservo: boolean;
  /** Pagó el Paquete Completo → TODOS los videos 2026 desbloqueados. */
  paquete_pagada: boolean;
  /** La persona tiene al menos una fila de kárdex. */
  tiene_kardex: boolean;
}

export interface VideosResponse {
  videos: Record<string, VideoItem[]>;
  membresia: MembresiaEstado;
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
export type YearNotas = '2023' | '2024' | '2025' | '2026';

// ============== Pagos 2026 ==============

export type PagoConcepto = 'por_participante' | 'pre_venta' | 'credencial' | 'credencial_unitaria';
export type PagoEstado = 'pendiente' | 'enviado' | 'verificado' | 'rechazado' | 'anulado';

export interface MetodoPago {
  id_metodo: string;
  metodo: string;
}

export interface CompromisoDeuda {
  concepto: PagoConcepto;
  id_referencia: string;
  descripcion: string;
  subdivision: string | null;
  bailarines: number | null;
  monto_total: number;
  pagado_verificado: number;
  pagado_pendiente: number;
  saldo: number;
  // Obra asociada (por_participante = obra; pre_venta = obra del convenio;
  // credencial = null, es a nivel agrupación). Para el header del modal de pago.
  obra?: string | null;
  // Agrupación a la que pertenece el compromiso. Una persona (representante)
  // puede tener varias agrupaciones → cada card se muestra con la suya.
  id_agrupacion?: string;
  nombre_agrupacion?: string;
  enlace_del_logo?: string | null;
}

export interface PagoHistorial {
  id_pago: string;
  numero_recibo: string | null;
  concepto: PagoConcepto;
  id_referencia: string;
  fecha: string | null;
  hora: string | null;
  id_metodo_pago: string | null;
  metodo_pago: string;
  monto: number;
  estado: PagoEstado;
  nombre_pagador: string | null;
  comprobante_url: string | null;
  recibo_pdf_url: string | null;
  observacion: string | null;
  id_agrupacion?: string;
  nombre_agrupacion?: string;
}

export interface PagosResumen {
  id_agrupacion: string;
  nombre_agrupacion: string;
  enlace_del_logo: string | null;
  /** Todas las agrupaciones que la persona representa (para header/selector). */
  agrupaciones?: { id_agrupacion: string; nombre_agrupacion: string; enlace_del_logo: string | null }[];
  compromisos: CompromisoDeuda[];
  historial: PagoHistorial[];
  totales: {
    total_deuda: number;
    pagado_verificado: number;
    pagado_pendiente: number;
    saldo: number;
  };
  metodos_pago: MetodoPago[];
}

/** Item del historial multi-año (vista normalizada `pagos_historial_all`). */
export interface PagoHistorialAno {
  ano: number;
  id_pago: string;
  numero_recibo: string | null;
  fecha: string | null;
  hora: string | null;
  concepto: PagoConcepto | 'otro' | 'kardex';
  id_referencia: string | null;
  metodo_pago: string;
  id_metodo_pago: string | null;
  monto: number;
  estado: PagoEstado;
  nombre_pagador: string | null;
  telefono_pagador: string | null;
  nombre_obra: string;
  id_agrupacion: string | null;
  agrupacion: string;
  subdivision: string | null;
  bailarines: number | null;
  comprobante_url: string | null;
  recibo_pdf_url: string | null;
}

export interface AnoConPagos {
  ano: number;
  total_pagos: number;
  total_monto: number;
}

export interface PagosHistorialRes {
  ok: true;
  ano: number | null;
  historial: PagoHistorialAno[];
  anos_disponibles: AnoConPagos[];
}

export interface PagoCrearReq {
  concepto: PagoConcepto;
  id_referencia: string;
  monto: number;
  id_metodo_pago: string;
  observacion?: string;
  comprobante?: File;
  /** Solo credencial: cantidad de credenciales a comprar (fija el compromiso). */
  cantidad?: number;
}

export interface PagoCrearRes {
  ok: true;
  id_pago: string;
  numero_recibo: string;
  estado: PagoEstado;
  comprobante_url: string | null;
  monto: number;
}

// ============== Admin Pagos (dashboard) ==============

export interface AdminRecaudadoConcepto {
  concepto: PagoConcepto;
  n_pagos: number;
  total_verificado: number;
  total_pendiente: number;
  total_rechazado: number;
}

export interface AdminPagoReciente {
  id_pago: string;
  numero_recibo: string | null;
  concepto: PagoConcepto;
  id_referencia: string | null;
  id_agrupacion: string | null;
  nombre_agrupacion: string | null;
  enlace_del_logo: string | null;
  fecha: string | null;
  hora: string | null;
  monto: number;
  estado: PagoEstado;
  metodo_pago: string | null;
  nombre_pagador: string | null;
  telefono_pagador: string | null;
  comprobante_url: string | null;
  recibo_pdf_url: string | null;
  created_at: string | null;
}

export interface AdminAgrupacionPagos {
  id_agrupacion: string;
  nombre_agrupacion: string | null;
  enlace_del_logo: string | null;
  total_deuda: number;
  pagado_verificado: number;
  pagado_pendiente: number;
  saldo: number;
  n_pagos: number;
}

export interface AdminResumenRes {
  resumen: AdminRecaudadoConcepto[];
}
export interface AdminPagosRecientesRes {
  pagos: AdminPagoReciente[];
}
export interface AdminAgrupacionesRes {
  agrupaciones: AdminAgrupacionPagos[];
}
export interface AdminAgrupacionDetalleRes {
  agrupacion: {
    id_agrupacion: string;
    nombre_agrupacion: string | null;
    enlace_del_logo: string | null;
  } | null;
  compromisos: CompromisoDeuda[];
  historial: PagoHistorial[];
}
