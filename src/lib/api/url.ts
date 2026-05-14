/**
 * Resuelve la URL de un endpoint PHP respetando la `base` de Vite.
 * En dev: `apiUrl("inscripcion.php")` → `/api/inscripcion.php` (proxy a PHP local).
 * En prod (base="/landing/"): `/landing/api/inscripcion.php`.
 */
export function apiUrl(endpoint: string): string {
  return `${import.meta.env.BASE_URL}api/${endpoint}`;
}
