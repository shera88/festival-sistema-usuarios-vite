import { z } from "zod";
import { CATEGORIAS, DIVISIONES, telefonoSchema } from "./inscripcion";

/**
 * Formulario de Registro de Solicitud — más simple que Inscripción.
 * No pide obra/coreógrafo/modalidad/logo; solo datos de contacto + la terna
 * género/categoría/división. Se persiste en `registro_solicitud_2026`. Staff
 * completa después las columnas administrativas (whatsappera, carta_invitacion,
 * estado, agente, etc.) — no las tocamos desde el formulario público.
 */

export const GENEROS_DE_DANZA = [
  { value: "folklore", label: "Folklore" },
  { value: "academico", label: "Académico" },
  { value: "urbano", label: "Urbano" },
] as const;

export { CATEGORIAS, DIVISIONES };

// genero/categoria/division ahora son multi-select. El backend recibe el array
// como string CSV (join(',')) — ver SolicitudForm.onSubmit. Mínimo 1 selección
// por campo.
const generoEnum = z.enum(GENEROS_DE_DANZA.map((g) => g.value) as [string, ...string[]]);
const categoriaEnum = z.enum(CATEGORIAS.map((c) => c.value) as [string, ...string[]]);
const divisionEnum = z.enum(DIVISIONES.map((d) => d.value) as [string, ...string[]]);

export const solicitudSchema = z.object({
  nombre_y_apellido: z
    .string()
    .trim()
    .min(3, "Mínimo 3 caracteres")
    .max(120, "Máximo 120 caracteres"),
  // id_contacto (uuid de festival_contactos_global) opcional — si el usuario
  // seleccionó un contacto registrado del autocomplete. Sirve para que el
  // trigger de registro_solicitud_2026 ramifique correctamente.
  id_contacto: z.string().optional(),
  numero_de_carnet: z
    .string()
    .trim()
    .min(4, "CI muy corto")
    .max(20, "CI muy largo")
    .regex(/^[0-9]+$/, "Solo números, sin guiones ni espacios"),
  agrupacion: z.string().trim().min(2, "Campo requerido").max(120),
  id_agrupacion: z.string().optional(),
  ciudad: z.string().trim().min(2, "Campo requerido").max(80),
  telefono: telefonoSchema,
  correo_electronico: z.string().trim().email("Correo inválido").max(120),
  genero: z.array(generoEnum).min(1, "Seleccione al menos un género"),
  categoria: z.array(categoriaEnum).min(1, "Seleccione al menos una categoría"),
  division: z.array(divisionEnum).min(1, "Seleccione al menos una división"),
});

export type SolicitudData = z.infer<typeof solicitudSchema>;
