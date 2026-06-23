import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  step1Schema,
  step2Schema,
  type Step1Data,
  type Step2Data,
  CATEGORIAS,
  DIVISIONES,
  SUBDIVISIONES,
} from "@/lib/schemas/inscripcion";
import { apiUrl } from "@/lib/api/url";
import { fetchWithTimeout } from "@/lib/api/fetch-timeout";
import { Step1Personal } from "./Step1Personal";
import { Step2Obra } from "./Step2Obra";
import { cn } from "@/lib/utils";

/** Mapea enum value → label respetando orden canónico del dict. */
function toLabel(
  value: string | undefined,
  dict: ReadonlyArray<{ value: string; label: string }>
): string {
  if (!value) return "";
  return dict.find((d) => d.value === value)?.label ?? value;
}

/**
 * Mensaje WhatsApp prellenado para mandar a +59162180085 después del submit.
 * Mismo tono que Solicitud — sin emojis, labels en *negrita* (markdown WA).
 */
function buildInscripcionWhatsAppMessage(s1: Step1Data, s2: Step2Data): string {
  const lines = [
    `*Nombre y Apellido:* ${s1.nombre_y_apellido}`,
    `*Agrupación:* ${s2.agrupacion}`,
    `*Ciudad:* ${s1.ciudad}`,
    `*Nombre de la obra:* ${s2.nombre_de_la_obra}`,
    `*Coreógrafo:* ${s2.coreografo}`,
    `*Categoría:* ${toLabel(s2.categoria, CATEGORIAS)}`,
    `*División:* ${toLabel(s2.division, DIVISIONES)}`,
    `*Subdivisión:* ${toLabel(s2.subdivision, SUBDIVISIONES)}`,
    `*Cantidad de bailarines:* ${s2.cantidad}`,
    `*Modalidad:* ${s2.modalidad}`,
  ];
  return [
    "Hola, acabo de llenar mi formulario de inscripción.",
    "",
    "Estos son mis datos:",
    "",
    lines.join("\n\n"),
  ].join("\n");
}

function StepDot({ active, done, label, step }: { active: boolean; done: boolean; label: string; step: number }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          "grid h-9 w-9 place-items-center rounded-full border-2 text-sm font-bold transition-all",
          done && "border-[var(--amber-primary)] bg-[var(--amber-primary)] text-white",
          active && !done && "border-[var(--amber-primary)] bg-[rgba(34,211,238,0.12)] text-[var(--amber-cream)]",
          !active && !done && "border-border bg-card text-muted-foreground"
        )}
      >
        {done ? (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          step
        )}
      </div>
      <div className="hidden text-sm md:block">
        <div className={cn("font-semibold", active || done ? "text-foreground" : "text-muted-foreground")}>
          {label}
        </div>
      </div>
    </div>
  );
}

interface InscripcionFormProps {
  step1Defaults?: Partial<Step1Data>;
  lockCarnet?: boolean;
}

export function InscripcionForm({ step1Defaults, lockCarnet }: InscripcionFormProps = {}) {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [step1, setStep1] = useState<Step1Data | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedWaUrl, setSubmittedWaUrl] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const onStep1Submit = (data: Step1Data) => {
    const parsed = step1Schema.safeParse(data);
    if (!parsed.success) {
      toast.error("Revise los datos del paso 1");
      return;
    }
    setStep1(parsed.data);
    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onStep2Submit = async (data: Step2Data) => {
    if (!step1) {
      toast.error("Complete primero el paso 1");
      setStep(1);
      return;
    }
    const parsed2 = step2Schema.safeParse(data);
    if (!parsed2.success) {
      toast.error("Revise los datos del paso 2");
      return;
    }

    const waUrl = `https://wa.me/59162180085?text=${encodeURIComponent(
      buildInscripcionWhatsAppMessage(step1, parsed2.data)
    )}`;

    setSubmitting(true);
    try {
      const fd = new FormData();
      const combined = { ...step1, ...parsed2.data };
      Object.entries(combined).forEach(([k, v]) => {
        // Files se envían aparte (no stringificar).
        if (k === "logo" || k === "foto_nueva") return;
        if (v === undefined || v === null) return;
        fd.append(k, String(v));
      });
      if (parsed2.data.logo instanceof File) {
        fd.append("logo", parsed2.data.logo);
      }
      if (step1.foto_nueva instanceof File) {
        fd.append("foto_nueva", step1.foto_nueva);
      }

      const res = await fetchWithTimeout(apiUrl("inscripcion.php"), { method: "POST", body: fd });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        const msg = json.error || `Error ${res.status}: no se pudo enviar la inscripción`;
        setSubmitError(msg);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      window.open(waUrl, "_blank", "noopener");
      setSubmittedWaUrl(waUrl);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      console.error(e);
      setSubmitError(
        e instanceof Error && /tardó demasiado/.test(e.message)
          ? e.message
          : "Error de red. Verifique su conexión e intente nuevamente.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (submittedWaUrl) {
    return (
      <div className="relative z-20 rounded-3xl border border-border bg-card/60 p-6 text-center shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)] backdrop-blur-sm md:p-10">
        <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-full bg-primary-gradient shadow-[0_0_40px_-8px_rgba(34,211,238,0.6)]">
          <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="#07080e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h2 className="text-xl font-extrabold tracking-tight">¡Inscripción enviada!</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Sus datos fueron registrados. WhatsApp se abrió automáticamente con sus datos prellenados — envíe el mensaje al equipo del festival.
        </p>
        <div className="mt-6 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/inscripciones")}
            className="rounded-full bg-primary-gradient px-6 py-3 text-sm font-bold text-white shadow-[0_10px_32px_-10px_rgba(168,85,247,0.55)]"
          >
            Ver mis inscripciones →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative z-20 rounded-3xl border border-border bg-card/60 p-6 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)] backdrop-blur-sm md:p-10">
      {submitError && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <svg viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0 fill-none stroke-current stroke-2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <div className="flex-1">
            <p className="font-semibold">No se pudo enviar la inscripción</p>
            <p className="mt-0.5 opacity-80">{submitError}</p>
            <p className="mt-1 opacity-60">Corrija los datos e intente nuevamente.</p>
          </div>
          <button type="button" onClick={() => setSubmitError(null)} className="opacity-50 hover:opacity-100">✕</button>
        </div>
      )}
      {/* Stepper */}
      <div className="mb-10 flex items-center justify-center gap-4 md:gap-8">
        <StepDot step={1} active={step === 1} done={step > 1} label="Datos personales" />
        <div className="h-px w-12 bg-border md:w-24" />
        <StepDot step={2} active={step === 2} done={false} label="Agrupación y obra" />
      </div>

      {step === 1 && (
        <Step1Personal
          defaultValues={step1 ?? (step1Defaults as Step1Data | undefined)}
          onSubmit={onStep1Submit}
          lockCarnet={lockCarnet}
        />
      )}
      {step === 2 && (
        <Step2Obra
          onBack={() => {
            setStep(1);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          onSubmit={onStep2Submit}
          submitting={submitting}
          idContacto={step1?.id_contacto ?? null}
        />
      )}
    </div>
  );
}
