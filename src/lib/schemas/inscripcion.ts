import { z } from "zod";

/**
 * Teléfono compartido por todos los formularios (inscripción, solicitud, kárdex).
 * Acepta entradas humanas con `+`, espacios, guiones y paréntesis; se queda solo
 * con los dígitos. Si detecta el prefijo boliviano `591`, lo remueve — los
 * números locales se guardan sin prefijo. Los extranjeros conservan su prefijo
 * país (sin `+`), ej. `5491123456789` para Argentina.
 *
 * Ejemplos de normalización:
 *   "+591 70000000"        → "70000000"
 *   "591 70000000"         → "70000000"
 *   "70000000"             → "70000000"
 *   "+54 9 11 2345-6789"   → "5491123456789"
 */
export const telefonoSchema = z
  .string()
  .trim()
  .transform((v) => {
    let digits = v.replace(/\D/g, "");
    if (digits.startsWith("591")) digits = digits.slice(3);
    return digits;
  })
  .pipe(
    z
      .string()
      .min(7, "Teléfono muy corto")
      .max(15, "Teléfono muy largo")
      .regex(/^[0-9]+$/, "Solo números, sin letras ni símbolos")
  );

export const CATEGORIAS = [
  { value: "colegios", label: "Colegios" },
  { value: "universidades", label: "Universidades" },
  { value: "agrupacion", label: "Agrupaciones" },
] as const;

export const DIVISIONES = [
  { value: "pre_infantil", label: "Pre Infantil", hint: "4 a 6 años" },
  { value: "infantil", label: "Infantil", hint: "7 a 10 años" },
  { value: "pre_juvenil", label: "Pre Juvenil", hint: "11 a 13 años" },
  { value: "juvenil", label: "Juvenil", hint: "14 a 17 años" },
  { value: "mayores", label: "Mayores", hint: "18 a 35 años" },
  { value: "adultos", label: "Adultos", hint: "36+ años" },
] as const;

export const SUBDIVISIONES = [
  { value: "solo", label: "Solo", hint: "1 integrante", min: 1, max: 1 },
  { value: "duo", label: "Dúo", hint: "2 integrantes", min: 2, max: 2 },
  { value: "grupo_pequeno", label: "Grupo Chico", hint: "3 a 14", min: 3, max: 14 },
  { value: "grupo_grande", label: "Grupo Grande", hint: "15 a 60", min: 15, max: 60 },
] as const;

export const MODALIDADES = [
  "FOLCLORE ORIENTAL",
  "FOLCLORE ANDINO",
  "FOLCLORE DEL VALLE",
  "FOLCLORE DEL CHACO",
  "FOLCLORE LATINOAMERICANO",
  "FOLCLORE ANDINO TINKU",
  "FOLCLORE POPULAR SAYA Y CAPORAL",
  "DANZA ÉTNICA",
  "BALLET CLÁSICO Y NEOCLÁSICO",
  "JAZZ DANCE CONTEMPORÁNEO",
  "BAILES TROPICALES",
  "BAILES DE SALÓN",
  "MODALIDAD LIBRE",
  "DANZA ÁRABE O INDÚ",
  "HIP HOP",
  "COMERCIAL DANCE",
  "DANZA URBANA LIBRE",
] as const;

/**
 * Género de danza derivado de la modalidad (FOLKLORE / ACADEMICO / URBANO),
 * según la convocatoria. El género NO es seleccionable: lo determina la
 * modalidad. Valores en MAYÚSCULA = los que persiste la BD
 * (`registro_de_inscripcion_2026.genero`). Debe coincidir con el backend
 * derive_genero().
 */
export const MODALIDAD_GENERO: Record<(typeof MODALIDADES)[number], "FOLKLORE" | "ACADEMICO" | "URBANO"> = {
  "FOLCLORE ORIENTAL": "FOLKLORE",
  "FOLCLORE ANDINO": "FOLKLORE",
  "FOLCLORE DEL VALLE": "FOLKLORE",
  "FOLCLORE DEL CHACO": "FOLKLORE",
  "FOLCLORE LATINOAMERICANO": "FOLKLORE",
  "FOLCLORE ANDINO TINKU": "FOLKLORE",
  "FOLCLORE POPULAR SAYA Y CAPORAL": "FOLKLORE",
  "DANZA ÉTNICA": "FOLKLORE",
  "BALLET CLÁSICO Y NEOCLÁSICO": "ACADEMICO",
  "JAZZ DANCE CONTEMPORÁNEO": "ACADEMICO",
  "BAILES TROPICALES": "ACADEMICO",
  "BAILES DE SALÓN": "ACADEMICO",
  "MODALIDAD LIBRE": "ACADEMICO",
  "DANZA ÁRABE O INDÚ": "ACADEMICO",
  "HIP HOP": "URBANO",
  "COMERCIAL DANCE": "URBANO",
  "DANZA URBANA LIBRE": "URBANO",
};

/** Etiqueta legible del género (para mostrar en UI). */
export const GENERO_LABEL: Record<"FOLKLORE" | "ACADEMICO" | "URBANO", string> = {
  FOLKLORE: "Folklore",
  ACADEMICO: "Académico",
  URBANO: "Urbano",
};

/** Devuelve el género de una modalidad (vacío si aún no se eligió modalidad). */
export function generoDeModalidad(modalidad?: string): "" | "FOLKLORE" | "ACADEMICO" | "URBANO" {
  if (!modalidad) return "";
  return MODALIDAD_GENERO[modalidad as (typeof MODALIDADES)[number]] ?? "ACADEMICO";
}

/**
 * Step 1 — datos personales del representante.
 *
 * `foto_url_actual` viene del match con un participante existente (URL de su
 * foto registrada). `foto_nueva` es el archivo que el usuario sube para
 * reemplazarla o aportar la suya por primera vez. La validación cruzada exige
 * que haya al menos una de las dos: si la persona ya tenía foto registrada,
 * puede dejar la actual; si no tenía, debe subir una.
 */
export const step1Schema = z
  .object({
    nombre_y_apellido: z
      .string()
      .trim()
      .min(3, "Mínimo 3 caracteres")
      .max(120, "Máximo 120 caracteres"),
    id_contacto: z.string().optional(),
    numero_de_carnet: z
      .string()
      .trim()
      .min(4, "CI muy corto")
      .max(20, "CI muy largo")
      .regex(/^[0-9]+$/, "Solo números, sin guiones ni espacios"),
    telefono: telefonoSchema,
    ciudad: z.string().trim().min(2, "Campo requerido").max(80),
    correo_electronico: z.string().trim().email("Correo inválido").max(120),
    foto_url_actual: z.string().optional(),
    foto_nueva: z
      .instanceof(File, { message: "Archivo requerido" })
      .refine((f) => f.size > 0, "Archivo vacío")
      .refine((f) => f.size < 10 * 1024 * 1024, "Máximo 10 MB")
      .refine(
        (f) => /^image\/(jpeg|png|webp|gif)$/.test(f.type),
        "Solo PNG, JPG, WebP o GIF"
      )
      .optional(),
  })
  .superRefine((data, ctx) => {
    const tieneFotoActual = !!data.foto_url_actual && data.foto_url_actual.length > 0;
    const tieneFotoNueva  = !!data.foto_nueva;
    if (!tieneFotoActual && !tieneFotoNueva) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["foto_nueva"],
        message: "Foto requerida — suba una imagen",
      });
    }
  });

/**
 * Step 2 — datos de la obra
 */
export const step2Schema = z
  .object({
    agrupacion: z.string().trim().min(2, "Campo requerido").max(120),
    id_agrupacion: z.string().optional(),
    nombre_de_la_obra: z.string().trim().min(2, "Campo requerido").max(180),
    coreografo: z.string().trim().min(2, "Seleccione o escriba un coreógrafo").max(120),
    id_coreografo: z.string().optional(),
    categoria: z.enum(CATEGORIAS.map((c) => c.value) as [string, ...string[]]),
    division: z.enum(DIVISIONES.map((d) => d.value) as [string, ...string[]]),
    subdivision: z.enum(SUBDIVISIONES.map((s) => s.value) as [string, ...string[]]),
    cantidad: z.coerce
      .number()
      .int("Debe ser un número entero")
      .min(1, "Mínimo 1 bailarín")
      .max(60, "Máximo 60 bailarines"),
    modalidad: z.enum(MODALIDADES),
    logo: z
      .instanceof(File, { message: "Archivo requerido" })
      .refine((f) => f.size > 0, "Archivo vacío")
      .refine((f) => f.size < 10 * 1024 * 1024, "Máximo 10 MB")
      .refine(
        (f) => /^image\/(jpeg|png|webp|gif)$/.test(f.type),
        "Solo PNG, JPG, WebP o GIF"
      )
      .optional(),
  })
  .refine(
    (data) => {
      const sub = SUBDIVISIONES.find((s) => s.value === data.subdivision);
      if (!sub) return true;
      return data.cantidad >= sub.min && data.cantidad <= sub.max;
    },
    {
      message: "La cantidad de bailarines no coincide con la subdivisión elegida",
      path: ["cantidad"],
    }
  );

export const inscripcionSchema = step1Schema.and(step2Schema);

export type Step1Data = z.infer<typeof step1Schema>;
export type Step2Data = z.infer<typeof step2Schema>;
export type InscripcionData = z.infer<typeof inscripcionSchema>;

/** Labels en español para mostrar en UI */
export const LABELS: Record<keyof InscripcionData, string> = {
  nombre_y_apellido: "Nombre y apellido",
  id_contacto: "ID Contacto",
  numero_de_carnet: "Carnet de identidad",
  telefono: "Teléfono",
  ciudad: "Ciudad",
  correo_electronico: "Correo electrónico",
  agrupacion: "Agrupación",
  id_agrupacion: "ID Agrupación",
  nombre_de_la_obra: "Nombre de la obra",
  coreografo: "Coreógrafo",
  id_coreografo: "ID Coreógrafo",
  categoria: "Categoría",
  division: "División",
  subdivision: "Subdivisión",
  cantidad: "Cantidad de bailarines",
  modalidad: "Modalidad",
  logo: "Logo",
  foto_url_actual: "Foto actual",
  foto_nueva: "Foto del participante",
};
