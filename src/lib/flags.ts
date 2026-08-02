// Interruptores de funcionalidades del portal de usuarios.
// Cambiar acá y volver a desplegar (build + deploy-portal-dist + force-upload-index).

// Formulario de inscripción: cuando es false, la página muestra "inscripciones
// cerradas" y se ocultan todos los accesos (sidebar, menú, botón del header, home).
export const INSCRIPCION_ABIERTA = false;

// Edición de inscripciones existentes (lápiz "Editar datos de la obra"): cuando es
// false, se oculta el botón de editar y no se puede modificar la obra. La gestión
// de multimedia (subir/confirmar/quitar) NO depende de este flag.
export const EDICION_INSCRIPCIONES_ABIERTA = false;
