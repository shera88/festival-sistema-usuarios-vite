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

/** Kárdex: solo el staff de la agrupación. Los bailarines NO lo ven. */
export function kardexVisibleParaRol(user: UsuarioConRoles): boolean {
  return esStaffDeAgrupacion(user);
}

/**
 * Primera sección a la que entra cada rol: la de siempre para el staff, y
 * Calificaciones para el bailarín, que es la primera que tiene disponible una
 * vez que Inscripciones y Kárdex son del staff. Punto único, para que el destino
 * al iniciar sesión y el del logo del encabezado no se contradigan.
 */
export function rutaInicioParaRol(user: UsuarioConRoles): string {
  return esStaffDeAgrupacion(user) ? '/inscripciones' : '/calificaciones';
}
