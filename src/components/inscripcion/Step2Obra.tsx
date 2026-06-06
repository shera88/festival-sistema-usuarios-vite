import { useRef, useState } from "react";
import { useForm, Controller, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import {
  step2Schema,
  type Step2Data,
  CATEGORIAS,
  DIVISIONES,
  SUBDIVISIONES,
  MODALIDADES,
  GENERO_LABEL,
  generoDeModalidad,
} from "@/lib/schemas/inscripcion";
import { ButtonGroup } from "@/components/ui/button-group";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CoreografoAutocomplete } from "./CoreografoAutocomplete";
import { AgrupacionAutocomplete } from "@/components/solicitud/AgrupacionAutocomplete";
import { ModalidadPicker } from "./ModalidadPicker";
import { ZoomableImage } from "@/components/ui/zoomable-image";
import { scrollToFirstError } from "@/lib/form-scroll";

const FIELD_ORDER = [
  "agrupacion",
  "nombre_de_la_obra",
  "coreografo",
  "categoria",
  "division",
  "subdivision",
  "cantidad",
  "modalidad",
  "logo",
] as const;

type Props = {
  onBack: () => void;
  onSubmit: (data: Step2Data) => void;
  submitting: boolean;
  /** id_contacto (uuid de festival_contactos_global) de la persona seleccionada
   *  en Step1 — alimenta sugerencias de agrupaciones relacionadas. */
  idContacto?: string | null;
};

export function Step2Obra({ onBack, onSubmit, submitting, idContacto }: Props) {
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<z.input<typeof step2Schema>, unknown, Step2Data>({
    resolver: zodResolver(step2Schema),
    mode: "onBlur",
  });

  const subdivision = watch("subdivision");
  const subdivisionInfo = SUBDIVISIONES.find((s) => s.value === subdivision);

  // Género: NO seleccionable. Se deriva automáticamente de la modalidad elegida
  // (convocatoria) y se actualiza al cambiar la modalidad.
  const modalidad = watch("modalidad");
  const generoCode = generoDeModalidad(modalidad);
  const generoLabel = generoCode ? GENERO_LABEL[generoCode] : "";

  // Textos observados para los autocompletes inline (agrupación y coreógrafo).
  const agrupacion = watch("agrupacion") ?? "";
  const coreografo = watch("coreografo") ?? "";

  // idAgrupacion linkeada (si la agrupación coincidió con una existente).
  // Alimenta el dropdown de coreógrafos relacionados y el preview del logo.
  const [idAgrupacionLinked, setIdAgrupacionLinked] = useState<string | null>(null);
  const [logoUrlActual, setLogoUrlActual] = useState<string | null>(null);

  const handleAgrupacionChange = (v: string) => {
    setValue("agrupacion", v, { shouldValidate: true });
    setValue("id_agrupacion", "");
    setIdAgrupacionLinked(null);
    setLogoUrlActual(null);
  };

  const handleAgrupacionMatch = (nombre: string, id_ag: string, logo?: string | null) => {
    setValue("agrupacion", nombre, { shouldValidate: true });
    setValue("id_agrupacion", id_ag);
    setIdAgrupacionLinked(id_ag || null);
    setLogoUrlActual(logo && logo.length > 0 ? logo : null);
  };

  const handleCoreografoChange = (v: string) => {
    setValue("coreografo", v, { shouldValidate: true });
    setValue("id_coreografo", "");
  };

  const handleCoreografoMatch = (nombre: string, id_c: string) => {
    setValue("coreografo", nombre, { shouldValidate: true });
    setValue("id_coreografo", id_c);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoNuevoPreview, setLogoNuevoPreview] = useState<string | null>(null);

  const onInvalid = (errs: FieldErrors<z.input<typeof step2Schema>>) => {
    scrollToFirstError(errs, FIELD_ORDER);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit, onInvalid)} noValidate className="space-y-8">
      {/* Agrupación — autocomplete inline */}
      <div data-field-anchor="agrupacion">
        <Label htmlFor="insc-agrupacion">Agrupación</Label>
        <AgrupacionAutocomplete
          id="insc-agrupacion"
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

      {/* Obra */}
      <div data-field-anchor="nombre_de_la_obra">
        <Label htmlFor="obra">Nombre de la obra</Label>
        <Input
          id="obra"
          placeholder="Nombre de la obra…"
          {...register("nombre_de_la_obra")}
          aria-invalid={!!errors.nombre_de_la_obra}
        />
        {errors.nombre_de_la_obra && (
          <p className="mt-1.5 text-xs text-[var(--amber-accent)]">{errors.nombre_de_la_obra.message}</p>
        )}
      </div>

      {/* Coreógrafo — autocomplete inline */}
      <div data-field-anchor="coreografo">
        <Label htmlFor="insc-coreografo">Coreógrafo</Label>
        <CoreografoAutocomplete
          id="insc-coreografo"
          value={coreografo}
          onTextChange={handleCoreografoChange}
          onMatch={handleCoreografoMatch}
          idAgrupacion={idAgrupacionLinked}
          ariaInvalid={!!errors.coreografo}
        />
        <input type="hidden" {...register("coreografo")} />
        <input type="hidden" {...register("id_coreografo")} />
        {errors.coreografo && (
          <p className="mt-2 text-xs text-[var(--amber-accent)]">{errors.coreografo.message}</p>
        )}
      </div>

      {/* Categoría — mobile: 1 col (stack, tap targets amplios, sin ambigüedad).
          Desktop: 3 cols iguales (una por opción). */}
      <div data-field-anchor="categoria">
        <Label>Categoría</Label>
        <Controller
          control={control}
          name="categoria"
          render={({ field }) => (
            <ButtonGroup
              options={[...CATEGORIAS]}
              value={field.value}
              onChange={field.onChange}
              size="md"
              className="grid-cols-1 sm:grid-cols-3 gap-3"
            />
          )}
        />
        {errors.categoria && (
          <p className="mt-2 text-xs text-[var(--amber-accent)]">Seleccione una categoría</p>
        )}
      </div>

      {/* División — mobile: 2 cols (compacto, igual que Subdivisión).
          Desktop: 3 cols row-major (2 filas × 3 cols, ocupa todo el ancho). */}
      <div data-field-anchor="division">
        <Label>División (por edad)</Label>
        <Controller
          control={control}
          name="division"
          render={({ field }) => (
            <ButtonGroup
              options={[...DIVISIONES]}
              value={field.value}
              onChange={field.onChange}
              size="md"
              className="grid-cols-2 sm:grid-cols-3 gap-3"
            />
          )}
        />
        {errors.division && (
          <p className="mt-2 text-xs text-[var(--amber-accent)]">Seleccione una división</p>
        )}
      </div>

      {/* Subdivisión */}
      <div data-field-anchor="subdivision">
        <Label>Subdivisión (por integrantes)</Label>
        <Controller
          control={control}
          name="subdivision"
          render={({ field }) => (
            <ButtonGroup
              options={SUBDIVISIONES.map((s) => ({ value: s.value, label: s.label, hint: s.hint }))}
              value={field.value}
              onChange={(v) => {
                field.onChange(v);
                const sub = SUBDIVISIONES.find((s) => s.value === v);
                if (sub && sub.min === sub.max) {
                  setValue("cantidad", sub.min, { shouldValidate: true });
                }
              }}
              columns={4}
            />
          )}
        />
        {errors.subdivision && (
          <p className="mt-2 text-xs text-[var(--amber-accent)]">Seleccione una subdivisión</p>
        )}
      </div>

      {/* Cantidad */}
      <div data-field-anchor="cantidad">
        <Label htmlFor="cantidad">
          Cantidad de bailarines
          {subdivisionInfo && (
            <span className="ml-2 text-xs font-normal text-foreground/60">
              (rango {subdivisionInfo.min}
              {subdivisionInfo.max !== subdivisionInfo.min ? `–${subdivisionInfo.max}` : ""})
            </span>
          )}
        </Label>
        <Input
          id="cantidad"
          type="number"
          min={subdivisionInfo?.min ?? 1}
          max={subdivisionInfo?.max ?? 60}
          inputMode="numeric"
          {...register("cantidad")}
          aria-invalid={!!errors.cantidad}
        />
        {errors.cantidad && (
          <p className="mt-1.5 text-xs text-[var(--amber-accent)]">{errors.cantidad.message}</p>
        )}
      </div>

      {/* Modalidad — 18 opciones, el Select simple obliga a scrollear mucho.
          Con buscador in-memory el usuario tipea "hip", "ballet", "folk" y encuentra
          su modalidad de un golpe. Accent-insensitive para "étnica" / "etnica". */}
      <div data-field-anchor="modalidad">
        <Label>Modalidad</Label>
        <Controller
          control={control}
          name="modalidad"
          render={({ field }) => (
            <ModalidadPicker
              modalidades={MODALIDADES}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
        {errors.modalidad && (
          <p className="mt-1.5 text-xs text-[var(--amber-accent)]">Seleccione una modalidad</p>
        )}
      </div>

      {/* Género — NO seleccionable. Se determina solo por la modalidad elegida
          (según la convocatoria) y se actualiza al cambiar la modalidad. */}
      <div data-field-anchor="genero">
        <Label>Género</Label>
        <div
          aria-readonly="true"
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-card/40 px-4 py-3 text-sm"
        >
          <span className={generoLabel ? "font-semibold text-foreground" : "text-foreground/50"}>
            {generoLabel || "Se asigna automáticamente al elegir la modalidad"}
          </span>
          <span className="rounded-md bg-[rgba(34,211,238,0.1)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-foreground/60">
            Automático
          </span>
        </div>
      </div>

      {/* Logo de la agrupación — si la agrupación coincidió con una existente
          y tiene logo registrado, se muestra como preview grande clickeable
          (lightbox para ampliar) con botón "Cambiar logo". Si no, área de
          upload tradicional. */}
      <div data-field-anchor="logo">
        <Label htmlFor="logo-file-input">Logo de la agrupación</Label>
        <Controller
          control={control}
          name="logo"
          render={({ field }) => {
            const reemplaza = !!logoFile;
            const conservaActual = !reemplaza && !!logoUrlActual;
            const tienePreview = reemplaza || conservaActual;
            const previewSrc = reemplaza ? logoNuevoPreview! : (logoUrlActual ?? "");
            const titulo = reemplaza
              ? "Nuevo logo seleccionado"
              : conservaActual
                ? "Logo registrado"
                : "Subir logo";
            const subtitulo = reemplaza
              ? `${(logoFile!.size / 1024 / 1024).toFixed(2)} MB · haga clic en la imagen para verla ampliada`
              : conservaActual
                ? "Haga clic en la imagen para verla ampliada"
                : "PNG, JPG, WebP o GIF — máximo 10 MB";
            return (
              <div className="rounded-xl border border-border bg-card/60 p-4">
                <input
                  ref={fileInputRef}
                  id="logo-file-input"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setLogoFile(file);
                      field.onChange(file);
                      const url = URL.createObjectURL(file);
                      setLogoNuevoPreview((prev) => {
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
                      alt="Logo de la agrupación"
                      triggerClassName="h-36 w-36 shrink-0 overflow-hidden rounded-full border border-border bg-card"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <label
                      htmlFor="logo-file-input"
                      className="grid h-36 w-36 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-full border border-dashed border-border bg-card/40 transition-colors hover:border-[rgba(34,211,238,0.5)] hover:bg-[rgba(34,211,238,0.05)]"
                    >
                      <div className="flex flex-col items-center gap-1.5 text-foreground/60">
                        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="17 8 12 3 7 8" />
                          <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                        <span className="text-[10px] font-semibold">Subir logo</span>
                      </div>
                    </label>
                  )}
                  <div className="w-full">
                    <div className="text-sm font-semibold text-foreground">{titulo}</div>
                    <div className="mt-1 text-xs text-foreground/65">{subtitulo}</div>
                    <div className="mt-3 flex flex-wrap justify-center gap-2">
                      <label
                        htmlFor="logo-file-input"
                        className="cursor-pointer rounded-full border border-border bg-background/60 px-4 py-1.5 text-xs font-semibold text-foreground/85 transition-colors hover:border-[rgba(34,211,238,0.45)] hover:bg-[rgba(34,211,238,0.06)]"
                      >
                        {tienePreview ? "Cambiar logo" : "Elegir archivo"}
                      </label>
                      {reemplaza && (
                        <button
                          type="button"
                          onClick={() => {
                            setLogoFile(null);
                            if (logoNuevoPreview) URL.revokeObjectURL(logoNuevoPreview);
                            setLogoNuevoPreview(null);
                            field.onChange(undefined);
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
        {errors.logo && (
          <p className="mt-1.5 text-xs text-[var(--amber-accent)]">
            {errors.logo.message as string}
          </p>
        )}
      </div>

      {/* Navegación */}
      <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-full border border-border bg-card/60 px-6 py-3 text-sm font-semibold text-foreground/80 transition-colors hover:text-foreground disabled:opacity-50 sm:w-auto"
        >
          <span>←</span> Volver atrás
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-primary-gradient px-8 py-3.5 text-sm font-bold text-white shadow-[0_10px_32px_-10px_rgba(168,85,247,0.55),inset_0_1px_0_rgba(255,255,255,0.28)] transition-all hover:-translate-y-[2px] hover:shadow-[0_16px_42px_-10px_rgba(168,85,247,0.7)] disabled:cursor-not-allowed disabled:opacity-60 sm:flex-1"
        >
          {submitting ? "Enviando…" : "Enviar inscripción"}
          {!submitting && <span>→</span>}
        </button>
      </div>
    </form>
  );
}
