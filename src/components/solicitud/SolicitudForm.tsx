import { useForm, Controller, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  solicitudSchema,
  type SolicitudData,
  GENEROS_DE_DANZA,
  CATEGORIAS,
  DIVISIONES,
} from "@/lib/schemas/solicitud";
import { apiUrl } from "@/lib/api/url";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ButtonGroup } from "@/components/ui/button-group";
import { AgrupacionAutocomplete } from "@/components/solicitud/AgrupacionAutocomplete";
import {
  NameAutocomplete,
  type ParticipanteDetalle,
} from "@/components/solicitud/NameAutocomplete";
import { scrollToFirstError } from "@/lib/form-scroll";

// Orden visual de los campos — se usa para que scrollToFirstError lleve al
// usuario al error más alto en el formulario, no al primero que devuelva RHF.
const FIELD_ORDER = [
  "nombre_y_apellido",
  "agrupacion",
  "numero_de_carnet",
  "ciudad",
  "telefono",
  "correo_electronico",
  "genero",
  "categoria",
  "division",
] as const;

/** Normaliza teléfono igual que `telefonoSchema`: solo dígitos, sin prefijo 591. */
function normalizePhone(v: string | null | undefined): string {
  if (v == null) return "";
  let d = String(v).replace(/\D/g, "");
  if (d.startsWith("591")) d = d.slice(3);
  return d;
}

/** Normaliza CI: solo dígitos. */
function normalizeCI(v: string | null | undefined): string {
  if (v == null) return "";
  return String(v).replace(/\D/g, "");
}

/**
 * Formulario de Solicitud — un solo paso, más liviano que Inscripción.
 * Los campos Nombre y Agrupación usan autocompletes inline (no pickers modales)
 * para que el usuario solo escriba; si el texto coincide exacto con algo de
 * participantes_global / instituciones, se linkea el id sin clic explícito.
 */
export function SolicitudForm({ defaultValues }: { defaultValues?: Partial<SolicitudData> } = {}) {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  // Teléfono registrado del participante seleccionado. NO se muestra ni se
  // autocompleta — se guarda en memoria solo para comparar contra lo que tipea
  // el usuario y mostrar un aviso si difieren. Privacidad: la PII no aparece
  // en el formulario.
  const [refTelefono, setRefTelefono] = useState<string | null>(null);
  // CI registrado del participante. Mismo patrón: comparación silenciosa,
  // alerta si difiere.
  const [refCI, setRefCI] = useState<string | null>(null);
  // Correo registrado del participante. Se compara contra lo tipeado para
  // mostrar aviso si difiere (no bloquea envío).
  const [refCorreo, setRefCorreo] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SolicitudData>({
    resolver: zodResolver(solicitudSchema),
    mode: "onBlur",
    defaultValues,
  });

  // Observamos los campos de texto libre para pasárselos a los autocompletes.
  // RHF mantiene la source of truth; los autocompletes son componentes
  // controlados que reflejan ese valor y notifican cambios vía callbacks.
  const nombre = watch("nombre_y_apellido") ?? "";
  const agrupacion = watch("agrupacion") ?? "";
  const idContacto = watch("id_contacto") ?? "";
  const ciActual = watch("numero_de_carnet") ?? "";
  const telefonoActual = watch("telefono") ?? "";
  const correoActual = watch("correo_electronico") ?? "";

  // Aviso suave cuando el teléfono ingresado difiere del registrado del
  // participante seleccionado. No bloquea el envío — solo pregunta.
  const telefonoDiffer = useMemo(() => {
    if (!refTelefono) return false;
    const u = normalizePhone(telefonoActual);
    if (u.length < 7) return false;
    return u !== refTelefono;
  }, [refTelefono, telefonoActual]);

  const ciDiffer = useMemo(() => {
    if (!refCI) return false;
    const u = normalizeCI(ciActual);
    if (u.length < 4) return false;
    return u !== refCI;
  }, [refCI, ciActual]);

  const correoDiffer = useMemo(() => {
    if (!refCorreo) return false;
    const u = correoActual.trim().toLowerCase();
    if (u.length < 5 || !u.includes("@")) return false;
    return u !== refCorreo.trim().toLowerCase();
  }, [refCorreo, correoActual]);

  // El usuario escribe o borra sin que el texto coincida con un participante
  // existente — mantenemos el nombre, liberamos id_contacto (indica al backend
  // que haga la rama "prospecto nuevo") y soltamos la referencia de PII.
  const handleNameChange = (v: string) => {
    setValue("nombre_y_apellido", v, { shouldValidate: true });
    setValue("id_contacto", "");
    setRefTelefono(null);
    setRefCI(null);
    setRefCorreo(null);
  };

  // Match con participante existente. Linkeamos id_contacto y prefilleamos
  // ciudad como sugerencia (el usuario puede sobrescribir). CI/tel/correo
  // NO se autocompletan — sólo guardamos los valores registrados en memoria
  // para detectar discrepancias y avisar.
  const handleNameMatch = (p: ParticipanteDetalle) => {
    setValue("nombre_y_apellido", p.nombre_y_apellido, { shouldValidate: true });
    setValue("id_contacto", p.id_contacto);
    setRefTelefono(p.telefono != null ? String(p.telefono) : null);
    setRefCI(p.numero_de_carnet != null ? String(p.numero_de_carnet) : null);
    setRefCorreo(p.correo_electronico ?? null);
    if (p.ciudad && !watch("ciudad")) {
      setValue("ciudad", p.ciudad, { shouldValidate: true });
    }
  };

  const handleAgrupacionChange = (v: string) => {
    setValue("agrupacion", v, { shouldValidate: true });
    setValue("id_agrupacion", "");
  };

  const handleAgrupacionMatch = (nombre_agr: string, id_ag: string) => {
    setValue("agrupacion", nombre_agr, { shouldValidate: true });
    setValue("id_agrupacion", id_ag);
  };

  const onInvalid = (errs: FieldErrors<SolicitudData>) => {
    scrollToFirstError(errs, FIELD_ORDER);
  };

  // Mapea enum values (lowercase) a labels humanos y los ordena según el orden
  // canónico del dict (división joven→mayor, género/categoría en orden visual).
  const toLabels = (xs: string | string[], dict: ReadonlyArray<{ value: string; label: string }>) => {
    const list = Array.isArray(xs) ? xs : [xs];
    return dict
      .filter((d) => list.includes(d.value))
      .map((d) => d.label)
      .concat(list.filter((v) => !dict.some((d) => d.value === v)))
      .join(" - ");
  };

  const buildWhatsAppMessage = (data: SolicitudData) => {
    // WhatsApp markdown: *negrita*. Sin emojis, líneas simples.
    const lines = [
      `*Nombre y Apellido:* ${data.nombre_y_apellido}`,
      `*Agrupación:* ${data.agrupacion}`,
      `*Ciudad:* ${data.ciudad}`,
      `*Género de danza:* ${toLabels(data.genero, GENEROS_DE_DANZA)}`,
      `*Categoría:* ${toLabels(data.categoria, CATEGORIAS)}`,
      `*División:* ${toLabels(data.division, DIVISIONES)}`,
    ];
    return [
      "Hola, acabo de llenar mi formulario de solicitud y convocatoria.",
      "",
      "Estos son mis datos:",
      "",
      lines.join("\n\n"),
    ].join("\n");
  };

  const onSubmit = async (data: SolicitudData) => {
    // Optimización: abrir wa.me DIRECTO con la URL final en el user gesture
    // del click, en vez de abrir about:blank y esperar al fetch. Esto deja
    // que la carga de wa.me + redirect a WhatsApp Web/App corra en paralelo
    // con el POST al backend. Tiempo en blanco baja de ~6s a ~1-2s.
    // Riesgo: si el backend falla, el tab WA queda abierto. Aceptable: el
    // usuario igual puede mandarnos el mensaje manualmente.
    const waUrl = `https://wa.me/59162180085?text=${encodeURIComponent(buildWhatsAppMessage(data))}`;
    window.open(waUrl, "_blank", "noopener");

    setSubmitting(true);
    try {
      // Backend persiste género/categoría/división como string CSV en mayúsculas.
      // Enviamos los enum keys (lowercase) separados por coma — el backend los
      // valida y los persiste como UPPERCASE join(",").
      const csv = (xs: string | string[]) =>
        Array.isArray(xs) ? xs.join(",") : String(xs);
      const payload = {
        ...data,
        genero: csv(data.genero),
        categoria: csv(data.categoria),
        division: csv(data.division),
      };
      const res = await fetch(apiUrl("solicitud.php"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        toast.error(json.error || `Error ${res.status}: no se pudo enviar la solicitud`);
        return;
      }

      toast.success("¡Solicitud enviada! Le contactaremos por WhatsApp.");
      navigate("/solicitud/gracias");
    } catch (e) {
      console.error(e);
      toast.error("Error de red. Intente nuevamente en unos segundos.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit, onInvalid)}
      noValidate
      className="relative z-20 space-y-8 rounded-3xl border border-border bg-card/60 p-6 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)] backdrop-blur-sm md:p-10"
    >
      {/* Nombre y apellido — input con autocomplete inline. Si el texto coincide
          (por clic o match exacto) con alguien de participantes_global, linkeamos
          id_contacto y prefillearmos ciudad/teléfono/correo. Si no coincide, al
          enviar se registra como persona nueva (rama prospecto en el backend). */}
      <div data-field-anchor="nombre_y_apellido">
        <Label htmlFor="nombre">Nombre y apellido</Label>
        <NameAutocomplete
          id="nombre"
          value={nombre}
          onTextChange={handleNameChange}
          onMatch={handleNameMatch}
          ariaInvalid={!!errors.nombre_y_apellido}
        />
        <input type="hidden" {...register("nombre_y_apellido")} />
        <input type="hidden" {...register("id_contacto")} />
        {errors.nombre_y_apellido && (
          <p className="mt-1.5 text-xs text-[var(--amber-accent)]">
            {errors.nombre_y_apellido.message}
          </p>
        )}
      </div>

      {/* Agrupación — mismo patrón que Nombre. Si no coincide con `instituciones`,
          se guarda como texto libre — Solicitud NUNCA crea fila en instituciones
          (solo Inscripción lo hace). */}
      <div data-field-anchor="agrupacion">
        <Label htmlFor="agrupacion">Agrupación</Label>
        <AgrupacionAutocomplete
          id="agrupacion"
          value={agrupacion}
          onTextChange={handleAgrupacionChange}
          onMatch={handleAgrupacionMatch}
          idContacto={idContacto}
          ariaInvalid={!!errors.agrupacion}
        />
        <input type="hidden" {...register("agrupacion")} />
        <input type="hidden" {...register("id_agrupacion")} />
        {errors.agrupacion && (
          <p className="mt-1.5 text-xs text-[var(--amber-accent)]">{errors.agrupacion.message}</p>
        )}
      </div>

      {/* Carnet de identidad — debajo de Agrupación. Mismo patrón de validación
          cruzada: si la persona ya existe en participantes_global y el CI
          tipeado difiere del registrado, alerta suave (no bloquea envío). */}
      <div data-field-anchor="numero_de_carnet">
        <Label htmlFor="ci">Carnet de identidad</Label>
        <Input
          id="ci"
          placeholder="Carnet de identidad…"
          inputMode="numeric"
          {...register("numero_de_carnet")}
          aria-invalid={!!errors.numero_de_carnet}
        />
        {errors.numero_de_carnet ? (
          <p className="mt-1.5 text-xs text-[var(--amber-accent)]">{errors.numero_de_carnet.message}</p>
        ) : ciDiffer ? (
          <p className="mt-1.5 text-xs text-[var(--warn-orange)]">
            ⚠ ¿Está seguro de que este es su número de carnet? Difiere del que tenemos registrado.
          </p>
        ) : null}
      </div>

      {/* Ciudad + Teléfono */}
      <div className="grid gap-5 md:grid-cols-2">
        <div data-field-anchor="ciudad">
          <Label htmlFor="ciudad">Ciudad</Label>
          <Input
            id="ciudad"
            placeholder="Ciudad…"
            {...register("ciudad")}
            aria-invalid={!!errors.ciudad}
          />
          {errors.ciudad && (
            <p className="mt-1.5 text-xs text-[var(--amber-accent)]">{errors.ciudad.message}</p>
          )}
        </div>

        <div data-field-anchor="telefono">
          <Label htmlFor="tel">Teléfono</Label>
          <Input
            id="tel"
            type="tel"
            inputMode="numeric"
            placeholder="Teléfono…"
            {...register("telefono")}
            aria-invalid={!!errors.telefono}
          />
          {errors.telefono ? (
            <p className="mt-1.5 text-xs text-[var(--amber-accent)]">{errors.telefono.message}</p>
          ) : telefonoDiffer ? (
            <p className="mt-1.5 text-xs text-[var(--warn-orange)]">
              ⚠ ¿Está seguro de que este es su teléfono? Difiere del que tenemos registrado.
            </p>
          ) : null}
        </div>
      </div>

      {/* Correo */}
      <div data-field-anchor="correo_electronico">
        <Label htmlFor="email">Correo electrónico</Label>
        <Input
          id="email"
          type="email"
          placeholder="Correo electrónico…"
          {...register("correo_electronico")}
          aria-invalid={!!errors.correo_electronico}
        />
        {errors.correo_electronico ? (
          <p className="mt-1.5 text-xs text-[var(--amber-accent)]">
            {errors.correo_electronico.message}
          </p>
        ) : correoDiffer ? (
          <p className="mt-1.5 text-xs text-[var(--warn-orange)]">
            ⚠ ¿Está seguro de que este es su correo? Difiere del que tenemos registrado.
          </p>
        ) : null}
      </div>

      {/* Género de danza — multi-select */}
      <div data-field-anchor="genero">
        <Label>Género de danza</Label>
        <Controller
          control={control}
          name="genero"
          render={({ field }) => (
            <ButtonGroup
              multiple
              options={[...GENEROS_DE_DANZA]}
              value={field.value ?? []}
              onChange={field.onChange}
              size="sm"
              className="grid-cols-3 gap-2"
            />
          )}
        />
        {errors.genero && (
          <p className="mt-2 text-xs text-[var(--amber-accent)]">{errors.genero.message ?? "Seleccione al menos un género"}</p>
        )}
      </div>

      {/* Categoría — multi-select */}
      <div data-field-anchor="categoria">
        <Label>Categoría</Label>
        <Controller
          control={control}
          name="categoria"
          render={({ field }) => (
            <ButtonGroup
              multiple
              options={[...CATEGORIAS]}
              value={field.value ?? []}
              onChange={field.onChange}
              size="sm"
              className="grid-cols-3 gap-2"
            />
          )}
        />
        {errors.categoria && (
          <p className="mt-2 text-xs text-[var(--amber-accent)]">{errors.categoria.message ?? "Seleccione al menos una categoría"}</p>
        )}
      </div>

      {/* División — multi-select */}
      <div data-field-anchor="division">
        <Label>División (por edad)</Label>
        <Controller
          control={control}
          name="division"
          render={({ field }) => (
            <ButtonGroup
              multiple
              options={[...DIVISIONES]}
              value={field.value ?? []}
              onChange={field.onChange}
              size="sm"
              className="grid-cols-3 gap-2"
            />
          )}
        />
        {errors.division && (
          <p className="mt-2 text-xs text-[var(--amber-accent)]">{errors.division.message ?? "Seleccione al menos una división"}</p>
        )}
      </div>

      {/* Submit */}
      <div className="border-t border-border pt-6">
        <button
          type="submit"
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-primary-gradient px-8 py-3.5 text-sm font-bold text-white shadow-[0_10px_32px_-10px_rgba(168,85,247,0.55),inset_0_1px_0_rgba(255,255,255,0.28)] transition-all hover:-translate-y-[2px] hover:shadow-[0_16px_42px_-10px_rgba(168,85,247,0.7)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Enviando…" : "Enviar solicitud"}
          {!submitting && <span>→</span>}
        </button>
      </div>
    </form>
  );
}
