/** Roles que pueden ver/usar la sección de Pagos: representantes, directores y
 *  coreógrafos (staff de la agrupación). Los bailarines no tienen ninguno de
 *  estos roles, por lo que NO ven Pagos. */
export function pagosVisibleParaRol(
  user: { es_representante?: boolean; es_director?: boolean; es_coreografo?: boolean } | null | undefined,
): boolean {
  return !!(user && (user.es_representante || user.es_director || user.es_coreografo));
}
