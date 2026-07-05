import { api } from './client';

export interface InscripcionEditarReq {
  id_inscripcion: string;
  nombre_de_la_obra: string;
  cantidad: number;
  modalidad: string;
  /** value slug: colegios | universidades | agrupacion */
  categoria: string;
  /** value slug: pre_infantil | infantil | pre_juvenil | juvenil | mayores | adultos */
  division: string;
}

export interface InscripcionEditarRes {
  ok: true;
  id_inscripcion: string;
  nombre_de_la_obra: string;
  cantidad: number;
  modalidad: string;
  genero: string;
  subdivision: string;
}

export interface InscripcionEditable {
  id_inscripcion: string;
  nombre_de_la_obra: string | null;
  cantidad: string | number | null;
  modalidad: string | null;
  /** Etiqueta almacenada en BD (UPPER), ej. "UNIVERSIDADES". Puede faltar en datos viejos. */
  categoria?: string | null;
  /** Etiqueta almacenada en BD (UPPER), ej. "PRE INFANTIL". Puede faltar en datos viejos. */
  division?: string | null;
}

export const inscripcionesApi = {
  /** Edita obra / participantes / modalidad de una inscripción propia. El backend
   *  re-deriva género (de la modalidad) y subdivisión (de la cantidad). */
  editar: (req: InscripcionEditarReq) =>
    api.post<InscripcionEditarRes>('/inscripcion-editar.php', req),

  /** Campos editables de una inscripción, por id_inscripcion o (pre-venta) por
   *  id_convenio. Para prellenar el modal de edición desde una card de Pagos. */
  obtener: (params: { id_inscripcion?: string; id_convenio?: string }) => {
    const qs = params.id_inscripcion
      ? `id_inscripcion=${encodeURIComponent(params.id_inscripcion)}`
      : `id_convenio=${encodeURIComponent(params.id_convenio ?? '')}`;
    return api.get<InscripcionEditable>(`/inscripcion-obtener.php?${qs}`);
  },
};
