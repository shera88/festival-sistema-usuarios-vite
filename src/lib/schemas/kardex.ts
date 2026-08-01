import { z } from "zod";
import { telefonoSchema } from "./inscripcion";

/**
 * Formulario de Kárdex — alta de una persona que se acredita al festival
 * (coreógrafo, bailarín, director, staff, auspiciador, jurado u organización).
 *
 * A diferencia de Inscripción/Solicitud, el Kárdex NO toca `participantes_global`
 * bajo ninguna circunstancia:
 *   - El picker de nombre lee desde participantes_global solo para autocompletar
 *     el formulario si la persona ya existía en festivales previos.
 *   - El destino de persistencia siempre es `registro_kardex_2026`, + la tabla
 *     maestra de su cargo (`directores` o `coreografos`) cuando aplica.
 *   - Si el cargo es BAILARIN/STAFF/AUSPICIADOR/JURADO/ORGANIZACION el dato
 *     solo queda en `registro_kardex_2026`.
 *   - Si es DIRECTOR → acumula en `directores`.
 *   - Si es COREOGRAFO → acumula en `coreografos`.
 * (Ver `upsertDirectorFromKardex` / `upsertCoreografoFromKardex` en
 *  master-tables.ts para la lógica de merge por CI/nombre.)
 */

export const CARGOS = [
  { value: "ENCARGADO", label: "Encargado" },
  { value: "COREOGRAFO", label: "Coreógrafo" },
  { value: "BAILARIN", label: "Bailarín" },
  { value: "DIRECTOR", label: "Director" },
  { value: "STAFF", label: "Staff" },
  { value: "AUSPICIADOR", label: "Auspiciador" },
  { value: "JURADO", label: "Jurado" },
  { value: "ORGANIZACION", label: "Organización" },
] as const;

export const kardexSchema = z.object({
  agrupacion: z.string().trim().min(2, "Campo requerido").max(120),
  // Kárdex restringe a agrupaciones YA inscritas al festival 2026 —
  // id_agrupacion viene de `registro_de_inscripcion_2026`. No se permite
  // texto libre. La validación va a nivel de campo (no superRefine) porque
  // superRefine solo corre si todos los field-level pasan — con texto libre
  // + otros campos vacíos, no se dispararía. El form muestra tanto
  // errors.agrupacion como errors.id_agrupacion, y ambos se scrollean al
  // mismo anchor vía `data-field-anchor="agrupacion id_agrupacion"`.
  id_agrupacion: z
    .string()
    .trim()
    .min(1, "Elija una agrupación de la lista de inscritas al festival 2026"),

  nombre_y_apellido: z
    .string()
    .trim()
    .min(3, "Mínimo 3 caracteres")
    .max(120, "Máximo 120 caracteres"),
  // id_contacto opcional — solo se completa si el participante ya existía en
  // participantes_global y el usuario lo seleccionó desde el picker. Sirve
  // para autocompletar el formulario; NO implica que vayamos a escribir en
  // participantes_global.
  id_contacto: z.string().optional(),

  ci: z
    .string()
    .trim()
    .min(4, "CI muy corto")
    .max(20, "CI muy largo")
    .regex(/^[0-9]+$/, "Solo números, sin guiones ni espacios"),

  cargo: z.enum(CARGOS.map((c) => c.value) as [string, ...string[]]),

  telefono: telefonoSchema,
  ciudad: z.string().trim().min(2, "Campo requerido").max(80),
  edad: z.coerce
    .number()
    .int("Debe ser un número entero")
    .min(3, "Edad mínima 3 años")
    .max(100, "Edad máxima 100 años"),
  correo_electronico: z.string().trim().email("Correo inválido").max(120),

  // Foto obligatoria — se usa para la credencial del festival.
  foto: z
    .instanceof(File, { message: "Foto requerida" })
    .refine((f) => f.size > 0, "Foto vacía")
    .refine((f) => f.size < 10 * 1024 * 1024, "Máximo 10 MB")
    .refine(
      (f) => /^image\/(jpeg|png|webp)$/.test(f.type),
      "Solo JPG, PNG o WebP"
    ),

  // Membresía de Videos — casilla opcional (reserva promo, acceso a SUS videos).
  membresia: z.boolean().default(false),

  // Membresía Paquete Completo — casilla opcional (reserva promo, TODOS los videos).
  membresia_paquete: z.boolean().default(false),

  // Bailes de la agrupación en los que participa la persona (multiselect).
  bailes: z
    .array(z.object({ id_inscripcion: z.string(), nombre_de_la_obra: z.string() }))
    .default([]),
});

export type KardexData = z.infer<typeof kardexSchema>;
