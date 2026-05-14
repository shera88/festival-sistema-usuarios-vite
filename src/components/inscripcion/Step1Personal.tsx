import { Controller, useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useRef, useState } from "react";
import { step1Schema, type Step1Data } from "@/lib/schemas/inscripcion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NameAutocomplete,
  type ParticipanteDetalle,
} from "@/components/solicitud/NameAutocomplete";
import { ZoomableImage } from "@/components/ui/zoomable-image";
import { scrollToFirstError } from "@/lib/form-scroll";

const FIELD_ORDER = [
  "nombre_y_apellido",
  "numero_de_carnet",
  "telefono",
  "ciudad",
  "correo_electronico",
  "foto_nueva",
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

type Props = {
  defaultValues?: Partial<Step1Data>;
  onSubmit: (data: Step1Data) => void;
  /** Si true, el campo Carnet de identidad queda bloqueado (readonly) */
  lockCarnet?: boolean;
};

export function Step1Personal({ defaultValues, onSubmit, lockCarnet = false }: Props) {
  // Datos registrados del participante seleccionado. Se guardan solo para
  // detectar discrepancias y avisar (CI/teléfono/correo). La PII no aparece en el
  // formulario salvo ciudad (que sí se prefilla como sugerencia).
  const [refTelefono, setRefTelefono] = useState<string | null>(null);
  const [refCI, setRefCI] = useState<string | null>(null);
  const [refCorreo, setRefCorreo] = useState<string | null>(null);
  // URL de la foto registrada del participante (si existió). Esta URL se
  // mantiene como `foto_url_actual` en el form; si el usuario sube una nueva,
  // `foto_nueva` toma precedencia y se reemplaza al enviar.
  // Initialize-from-defaultValues: cuando InscripcionForm guarda step1 y el
  // usuario va a Step2 + vuelve, este componente se remonta con los valores
  // previos. La foto registrada (URL legacy) y la foto recién subida (File)
  // se restauran del defaultValues; sino se perderían entre transiciones.
  const [fotoActualUrl, setFotoActualUrl] = useState<string | null>(
    defaultValues?.foto_url_actual && defaultValues.foto_url_actual.length > 0
      ? defaultValues.foto_url_actual
      : null
  );
  const [fotoNuevaPreview, setFotoNuevaPreview] = useState<string | null>(() =>
    defaultValues?.foto_nueva instanceof File
      ? URL.createObjectURL(defaultValues.foto_nueva)
      : null
  );
  // NO revocamos el blob URL en el cleanup de unmount — porque el componente
  // se monta/desmonta al ir y volver entre Step1↔Step2, y revocar el blob
  // rompe la próxima carga aunque el File siga vivo en defaultValues. El
  // browser GC los blobs huérfanos al cerrar la página. Solo revocamos
  // explícitamente cuando el usuario reemplaza la foto o quita la actual
  // (ver onChange / botón Quitar).
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    control,
    formState: { errors },
  } = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
    defaultValues,
    mode: "onBlur",
  });

  const nombre = watch("nombre_y_apellido") ?? "";
  const telefonoActual = watch("telefono") ?? "";
  const ciActual = watch("numero_de_carnet") ?? "";
  const correoActual = watch("correo_electronico") ?? "";

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

  const handleNombreChange = (v: string) => {
    setValue("nombre_y_apellido", v, { shouldValidate: true });
    setValue("id_contacto", "");
    setValue("foto_url_actual", "");
    setRefTelefono(null);
    setRefCI(null);
    setRefCorreo(null);
    setFotoActualUrl(null);
  };

  // Match con participante existente — linkeamos id_contacto y prefilleamos
  // ciudad como sugerencia. Tel/CI/correo NO se autocompletan (privacidad);
  // sólo guardamos los valores registrados en memoria para detectar
  // discrepancias. Foto: si tenía registrada, se muestra como actual con
  // opción de cambiarla; si no, el usuario debe subir una.
  const handleNombreMatch = (p: ParticipanteDetalle) => {
    setValue("nombre_y_apellido", p.nombre_y_apellido, { shouldValidate: true });
    setValue("id_contacto", p.id_contacto);
    setRefTelefono(p.telefono != null ? String(p.telefono) : null);
    setRefCI(p.numero_de_carnet != null ? String(p.numero_de_carnet) : null);
    setRefCorreo(p.correo_electronico ?? null);
    if (p.ciudad && !watch("ciudad")) {
      setValue("ciudad", p.ciudad, { shouldValidate: true });
    }
    const url = p.foto_url ?? "";
    setValue("foto_url_actual", url);
    setFotoActualUrl(url || null);
  };

  const onInvalid = (errs: FieldErrors<Step1Data>) => {
    scrollToFirstError(errs, FIELD_ORDER);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit, onInvalid)} noValidate className="space-y-6">
      <div data-field-anchor="nombre_y_apellido">
        <Label htmlFor="insc-nombre">Nombre y apellido</Label>
        <NameAutocomplete
          id="insc-nombre"
          value={nombre}
          onTextChange={handleNombreChange}
          onMatch={handleNombreMatch}
          ariaInvalid={!!errors.nombre_y_apellido}
        />
        <input type="hidden" {...register("nombre_y_apellido")} />
        <input type="hidden" {...register("id_contacto")} />
        <input type="hidden" {...register("foto_url_actual")} />
        {errors.nombre_y_apellido && (
          <p className="mt-1.5 text-xs text-[var(--amber-accent)]">{errors.nombre_y_apellido.message}</p>
        )}
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div data-field-anchor="numero_de_carnet">
          <Label htmlFor="ci">Carnet de identidad</Label>
          <Input
            id="ci"
            placeholder="Carnet de identidad…"
            inputMode="numeric"
            readOnly={lockCarnet}
            disabled={lockCarnet}
            {...register("numero_de_carnet")}
            aria-invalid={!!errors.numero_de_carnet}
          />
          {lockCarnet ? (
            <p className="mt-1.5 text-xs text-muted-foreground">No modificable</p>
          ) : errors.numero_de_carnet ? (
            <p className="mt-1.5 text-xs text-[var(--amber-accent)]">{errors.numero_de_carnet.message}</p>
          ) : ciDiffer ? (
            <p className="mt-1.5 text-xs text-[var(--warn-orange)]">
              ⚠ ¿Está seguro de que este es su número de carnet? Difiere del que tenemos registrado.
            </p>
          ) : null}
        </div>

        <div data-field-anchor="telefono">
          <Label htmlFor="tel">Teléfono</Label>
          <Input
            id="tel"
            type="tel"
            placeholder="Teléfono…"
            inputMode="numeric"
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
            <p className="mt-1.5 text-xs text-[var(--amber-accent)]">{errors.correo_electronico.message}</p>
          ) : correoDiffer ? (
            <p className="mt-1.5 text-xs text-[var(--warn-orange)]">
              ⚠ ¿Está seguro de que este es su correo? Difiere del que tenemos registrado.
            </p>
          ) : null}
        </div>
      </div>

      {/* Foto del participante — si ya existía una registrada, se muestra
          como preview grande (clickeable para ampliar en lightbox) con
          botón para cambiarla. Si no había, el usuario sube la suya. */}
      <div data-field-anchor="foto_nueva">
        <Label htmlFor="foto-input">Foto del participante</Label>
        <Controller
          control={control}
          name="foto_nueva"
          render={({ field }) => {
            const reemplaza = !!fotoNuevaPreview;
            const conservaActual = !reemplaza && !!fotoActualUrl;
            const tienePreview = reemplaza || conservaActual;
            const previewSrc = reemplaza ? fotoNuevaPreview! : (fotoActualUrl ?? "");
            const titulo = reemplaza
              ? "Nueva foto seleccionada"
              : conservaActual
                ? "Foto registrada"
                : "Subir foto";
            const subtitulo = reemplaza
              ? "Haga clic en la imagen para verla ampliada"
              : conservaActual
                ? "Haga clic en la imagen para verla ampliada"
                : "PNG, JPG, WebP o GIF — máximo 10 MB";
            return (
              <div className="rounded-xl border border-border bg-card/60 p-4">
                <input
                  ref={fileInputRef}
                  id="foto-input"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      field.onChange(file);
                      const url = URL.createObjectURL(file);
                      setFotoNuevaPreview((prev) => {
                        if (prev) URL.revokeObjectURL(prev);
                        return url;
                      });
                    }
                  }}
                />
                <div className="flex flex-col items-center gap-3 text-center">
                  {tienePreview ? (
                    <ZoomableImage
                      src={previewSrc}
                      alt="Foto del participante"
                      triggerClassName="h-36 w-36 shrink-0 overflow-hidden rounded-full border border-border bg-card"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <label
                      htmlFor="foto-input"
                      className="grid h-36 w-36 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-full border border-dashed border-border bg-card/40 transition-colors hover:border-[rgba(34,211,238,0.5)] hover:bg-[rgba(34,211,238,0.05)]"
                    >
                      <div className="flex flex-col items-center gap-1.5 text-foreground/60">
                        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="17 8 12 3 7 8" />
                          <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                        <span className="text-[10px] font-semibold">Subir foto</span>
                      </div>
                    </label>
                  )}
                  <div className="w-full">
                    <div className="text-sm font-semibold text-foreground">{titulo}</div>
                    <div className="mt-1 text-xs text-foreground/65">{subtitulo}</div>
                    <div className="mt-3 flex flex-wrap justify-center gap-2">
                      <label
                        htmlFor="foto-input"
                        className="cursor-pointer rounded-full border border-border bg-background/60 px-4 py-1.5 text-xs font-semibold text-foreground/85 transition-colors hover:border-[rgba(34,211,238,0.45)] hover:bg-[rgba(34,211,238,0.06)]"
                      >
                        {tienePreview ? "Cambiar foto" : "Elegir archivo"}
                      </label>
                      {reemplaza && (
                        <button
                          type="button"
                          onClick={() => {
                            field.onChange(undefined);
                            if (fotoNuevaPreview) URL.revokeObjectURL(fotoNuevaPreview);
                            setFotoNuevaPreview(null);
                            if (fileInputRef.current) fileInputRef.current.value = "";
                          }}
                          className="rounded-full border border-border bg-background/60 px-4 py-1.5 text-xs font-semibold text-foreground/75 hover:bg-background"
                        >
                          Quitar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          }}
        />
        {errors.foto_nueva && (
          <p className="mt-1.5 text-xs text-[var(--amber-accent)]">
            {errors.foto_nueva.message as string}
          </p>
        )}
      </div>

      <div className="pt-4">
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-full bg-primary-gradient px-8 py-3.5 text-sm font-bold text-white shadow-[0_10px_32px_-10px_rgba(168,85,247,0.55),inset_0_1px_0_rgba(255,255,255,0.28)] transition-all hover:-translate-y-[2px] hover:shadow-[0_16px_42px_-10px_rgba(168,85,247,0.7)]"
        >
          Siguiente
          <span>→</span>
        </button>
      </div>
    </form>
  );
}
