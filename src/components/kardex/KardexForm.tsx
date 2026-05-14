import { useMemo, useRef, useState } from "react";
import { useForm, Controller, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { z } from "zod";
import { kardexSchema, type KardexData, CARGOS } from "@/lib/schemas/kardex";
import { apiUrl } from "@/lib/api/url";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  NameAutocomplete,
  type ParticipanteDetalle,
} from "@/components/solicitud/NameAutocomplete";
import { AgrupacionInscritasDropdown } from "@/components/kardex/AgrupacionInscritasDropdown";
import { scrollToFirstError } from "@/lib/form-scroll";

const FIELD_ORDER = [
  "agrupacion",
  "id_agrupacion",
  "nombre_y_apellido",
  "ci",
  "cargo",
  "telefono",
  "ciudad",
  "edad",
  "correo_electronico",
  "foto",
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
 * Formulario de Kárdex — alta de una persona acreditada al festival.
 *
 * El ParticipantePicker solo sirve para AUTOCOMPLETAR campos cuando la
 * persona ya existía en participantes_global de festivales previos; el backend
 * no escribe en participantes_global bajo ningún escenario (regla del festival).
 */
export function KardexForm({ defaultValues }: { defaultValues?: Partial<z.input<typeof kardexSchema>> } = {}) {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const fotoInputRef = useRef<HTMLInputElement>(null);
  // Datos registrados del participante seleccionado. NO se muestran ni
  // autocompletan — se guardan en memoria solo para comparar contra lo que
  // tipea el usuario y mostrar un aviso si difieren. Privacidad: la PII no
  // aparece en el formulario.
  const [refTelefono, setRefTelefono] = useState<string | null>(null);
  const [refCI, setRefCI] = useState<string | null>(null);

  // Separamos el tipo de entrada (z.input) del tipo de salida (KardexData)
  // porque `z.coerce.number()` en `edad` convierte string→number: el input
  // que llega del form es string, la salida parseada es number. Sin los 3
  // genéricos, el resolver no tipa bien (mismo fix que aplicamos a Step2Obra).
  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm<z.input<typeof kardexSchema>, unknown, KardexData>({
    resolver: zodResolver(kardexSchema),
    mode: "onBlur",
    defaultValues,
  });

  // RHF sigue siendo la fuente de verdad — los autocompletes son controlados
  // y usan `watch` para leer y `setValue` para escribir.
  const nombre = watch("nombre_y_apellido") ?? "";
  const agrupacion = watch("agrupacion") ?? "";
  const telefonoActual = watch("telefono") ?? "";
  const ciActual = watch("ci") ?? "";

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

  // Usuario escribió / borró — mantenemos el texto, liberamos id_contacto y
  // soltamos las referencias de PII (señal al backend: registrar como persona
  // nueva, sin tocar participantes_global).
  const handleNombreChange = (v: string) => {
    setValue("nombre_y_apellido", v, { shouldValidate: true });
    setValue("id_contacto", "");
    setRefTelefono(null);
    setRefCI(null);
  };

  // Match contra participantes_global (clic o match exacto reactivo) —
  // linkeamos id_contacto pero NO autocompletamos CI/tel/ciudad/correo
  // (privacidad). Solo guardamos CI y teléfono registrados en memoria
  // para detectar discrepancias al tipear.
  const handleNombreMatch = (p: ParticipanteDetalle) => {
    setValue("nombre_y_apellido", p.nombre_y_apellido, { shouldValidate: true });
    setValue("id_contacto", p.id_contacto);
    setRefTelefono(p.telefono != null ? String(p.telefono) : null);
    setRefCI(p.numero_de_carnet != null ? String(p.numero_de_carnet) : null);
  };

  // En Kárdex la agrupación es selección pura desde dropdown — no hay texto
  // libre, así que solo necesitamos un handler de "selección" que setee
  // ambos campos (texto + id) en un solo gesto.
  const handleAgrupacionSelect = (nombre_agr: string, id_ag: string) => {
    setValue("agrupacion", nombre_agr, { shouldValidate: true });
    setValue("id_agrupacion", id_ag, { shouldValidate: true });
  };

  const onInvalid = (errs: FieldErrors<z.input<typeof kardexSchema>>) => {
    scrollToFirstError(errs, FIELD_ORDER);
  };

  const onSubmit = async (data: KardexData) => {
    setSubmitting(true);
    try {
      const fd = new FormData();
      for (const [k, v] of Object.entries(data)) {
        if (v == null) continue;
        if (k === "foto" && v instanceof File) {
          fd.append("foto", v);
        } else {
          fd.append(k, String(v));
        }
      }
      const res = await fetch(apiUrl("kardex.php"), { method: "POST", body: fd });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        toast.error(json.error || `Error ${res.status}: no se pudo registrar el kárdex`);
        return;
      }
      toast.success("¡Kárdex registrado con éxito!");
      navigate("/kardex/gracias");
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
      {/* 1. Agrupación — dropdown con lista de inscritas al festival 2026
          (mirando `registro_de_inscripcion_2026`). Tiene buscador local que
          filtra la lista precargada — no hay texto libre ni creación nueva. */}
      <div data-field-anchor="agrupacion id_agrupacion">
        <Label htmlFor="kardex-agrupacion">Agrupación</Label>
        <AgrupacionInscritasDropdown
          id="kardex-agrupacion"
          value={agrupacion}
          valueId={watch("id_agrupacion") ?? ""}
          onSelect={handleAgrupacionSelect}
          ariaInvalid={!!errors.agrupacion || !!errors.id_agrupacion}
        />
        <input type="hidden" {...register("agrupacion")} />
        <input type="hidden" {...register("id_agrupacion")} />
        {(errors.agrupacion || errors.id_agrupacion) && (
          <p className="mt-1.5 text-xs text-[var(--amber-accent)]">
            {errors.agrupacion?.message ?? errors.id_agrupacion?.message}
          </p>
        )}
      </div>

      {/* 2. Nombre y apellido — autocomplete inline: si coincide con
          participantes_global prellena CI/tel/ciudad/correo; si no, se
          registra como persona nueva sin tocar participantes_global. */}
      <div data-field-anchor="nombre_y_apellido">
        <Label htmlFor="kardex-nombre">Nombre y apellido</Label>
        <NameAutocomplete
          id="kardex-nombre"
          value={nombre}
          onTextChange={handleNombreChange}
          onMatch={handleNombreMatch}
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

      {/* 3. CI */}
      <div data-field-anchor="ci">
        <Label htmlFor="ci">Carnet de identidad</Label>
        <Input
          id="ci"
          inputMode="numeric"
          placeholder="Solo números…"
          {...register("ci")}
          aria-invalid={!!errors.ci}
        />
        {errors.ci ? (
          <p className="mt-1.5 text-xs text-[var(--amber-accent)]">{errors.ci.message}</p>
        ) : ciDiffer ? (
          <p className="mt-1.5 text-xs text-[var(--amber-soft)]">
            ¿Está seguro de que este es su número de carnet? Difiere del que tenemos registrado.
          </p>
        ) : null}
      </div>

      {/* 4. Cargo — dropdown */}
      <div data-field-anchor="cargo">
        <Label htmlFor="cargo">Cargo</Label>
        <Controller
          control={control}
          name="cargo"
          render={({ field }) => (
            <Select value={field.value ?? ""} onValueChange={field.onChange}>
              <SelectTrigger
                id="cargo"
                className="h-11 w-full rounded-xl border-border bg-card/60 px-4 text-sm text-foreground hover:border-[rgba(34,211,238,0.4)]"
                aria-invalid={!!errors.cargo}
              >
                {/* base-ui Select.Value por defecto renderiza el `value` crudo; le
                    pasamos children as function para mostrar el label "Director"
                    en vez del value "DIRECTOR" cuando esté seleccionado. */}
                <SelectValue placeholder="Seleccione un cargo…">
                  {(val) =>
                    val
                      ? CARGOS.find((c) => c.value === val)?.label ?? val
                      : "Seleccione un cargo…"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {CARGOS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.cargo && (
          <p className="mt-2 text-xs text-[var(--amber-accent)]">Seleccione un cargo</p>
        )}
      </div>

      {/* 5-6. Teléfono + Ciudad */}
      <div className="grid gap-5 md:grid-cols-2">
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
            <p className="mt-1.5 text-xs text-[var(--amber-soft)]">
              ¿Está seguro de que este es su teléfono? Difiere del que tenemos registrado.
            </p>
          ) : null}
        </div>

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
      </div>

      {/* 7-8. Edad + Correo */}
      <div className="grid gap-5 md:grid-cols-2">
        <div data-field-anchor="edad">
          <Label htmlFor="edad">Edad</Label>
          <Input
            id="edad"
            type="number"
            inputMode="numeric"
            min={3}
            max={100}
            placeholder="Edad…"
            {...register("edad")}
            aria-invalid={!!errors.edad}
          />
          {errors.edad && (
            <p className="mt-1.5 text-xs text-[var(--amber-accent)]">{errors.edad.message}</p>
          )}
        </div>

        <div data-field-anchor="correo_electronico">
          <Label htmlFor="email">Correo electrónico</Label>
          <Input
            id="email"
            type="email"
            placeholder="correo@ejemplo.com"
            {...register("correo_electronico")}
            aria-invalid={!!errors.correo_electronico}
          />
          {errors.correo_electronico && (
            <p className="mt-1.5 text-xs text-[var(--amber-accent)]">
              {errors.correo_electronico.message}
            </p>
          )}
        </div>
      </div>

      {/* 9. Foto — obligatoria para credencial */}
      <div data-field-anchor="foto">
        <Label htmlFor="foto-file-input">Foto para credencial</Label>
        <Controller
          control={control}
          name="foto"
          render={({ field }) => (
            <div className="relative">
              <input
                ref={fotoInputRef}
                id="foto-file-input"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setFotoFile(file);
                    field.onChange(file);
                    const url = URL.createObjectURL(file);
                    setFotoPreview(url);
                  }
                }}
              />
              <label
                htmlFor="foto-file-input"
                className="flex w-full cursor-pointer items-center gap-4 rounded-xl border border-dashed border-border bg-card/60 p-5 text-left transition-colors hover:border-[rgba(34,211,238,0.5)] hover:bg-[rgba(34,211,238,0.05)]"
              >
                <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-primary-gradient text-white">
                  {fotoPreview ? (
                    <img
                      src={fotoPreview}
                      alt="Vista previa"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <svg
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm font-semibold text-foreground">
                    {fotoFile ? fotoFile.name : "Seleccionar foto"}
                  </div>
                  <div className="mt-0.5 text-xs text-foreground/65">
                    {fotoFile
                      ? `${(fotoFile.size / 1024 / 1024).toFixed(2)} MB · haga clic para cambiar`
                      : "PNG, JPG o WebP — máximo 10 MB"}
                  </div>
                </div>
              </label>
              {fotoFile && (
                <button
                  type="button"
                  onClick={() => {
                    setFotoFile(null);
                    if (fotoPreview) URL.revokeObjectURL(fotoPreview);
                    setFotoPreview(null);
                    field.onChange(undefined);
                    if (fotoInputRef.current) fotoInputRef.current.value = "";
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full border border-border bg-background/80 px-3 py-1 text-xs font-semibold text-foreground/80 hover:bg-background"
                >
                  Quitar
                </button>
              )}
            </div>
          )}
        />
        {errors.foto && (
          <p className="mt-1.5 text-xs text-[var(--amber-accent)]">
            {errors.foto.message as string}
          </p>
        )}
      </div>

      {/* Submit */}
      <div className="border-t border-border pt-6">
        <button
          type="submit"
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-primary-gradient px-8 py-3.5 text-sm font-bold text-white shadow-[0_10px_32px_-10px_rgba(168,85,247,0.55),inset_0_1px_0_rgba(255,255,255,0.28)] transition-all hover:-translate-y-[2px] hover:shadow-[0_16px_42px_-10px_rgba(168,85,247,0.7)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Enviando…" : "Registrar kárdex"}
          {!submitting && <span>→</span>}
        </button>
      </div>
    </form>
  );
}
