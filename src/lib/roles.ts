type UsuarioConRoles =
  | { es_representante?: boolean; es_director?: boolean; es_coreografo?: boolean }
  | null
  | undefined;

/**
 * Staff de la agrupación: encargado (representante), director o coreógrafo.
 *
 * Es quien gestiona la agrupación, frente a los bailarines, que en la base
 * figuran como `solicitante` y no llevan ninguno de estos tres indicadores.
 * Criterio único para las secciones reservadas a la gestión.
 */
export function esStaffDeAgrupacion(user: UsuarioConRoles): boolean {
  return !!(user && (user.es_representante || user.es_director || user.es_coreografo));
}

/** Pagos: solo el staff de la agrupación. Los bailarines NO lo ven. */
export function pagosVisibleParaRol(user: UsuarioConRoles): boolean {
  return esStaffDeAgrupacion(user);
}

/** Inscripciones: solo el staff de la agrupación. Los bailarines NO lo ven. */
export function inscripcionesVisibleParaRol(user: UsuarioConRoles): boolean {
  return esStaffDeAgrupacion(user);
}
