import { cn } from "@/lib/utils";

export type ButtonGroupOption = {
  value: string;
  label: string;
  hint?: string;
  /** Opción bloqueada: visible pero no seleccionable (ej. subdivisión no disponible). */
  disabled?: boolean;
};

type SingleProps = {
  multiple?: false;
  value?: string;
  onChange: (value: string) => void;
};

type MultiProps = {
  multiple: true;
  value?: string[];
  onChange: (value: string[]) => void;
};

type CommonProps = {
  options: ButtonGroupOption[];
  columns?: 1 | 2 | 3 | 4 | 5 | 6;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
  disabled?: boolean;
};

type Props = CommonProps & (SingleProps | MultiProps);

const COLS_MAP: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-2 sm:grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-2 md:grid-cols-4",
  5: "grid-cols-2 sm:grid-cols-3 md:grid-cols-5",
  6: "grid-cols-2 sm:grid-cols-3 md:grid-cols-6",
};

const SIZE_MAP = {
  xs: "px-2 py-1 text-[10.5px]",
  sm: "px-2.5 py-1.5 text-[11.5px]",
  md: "px-3 py-2 text-[12.5px]",
  lg: "px-3.5 py-2.5 text-[13.5px]",
};

export function ButtonGroup(props: Props) {
  const {
    options,
    columns = 3,
    size = "sm",
    className,
    disabled,
  } = props;
  const isMulti = props.multiple === true;
  const selectedSet = new Set(
    isMulti ? props.value ?? [] : props.value ? [props.value] : []
  );

  const toggle = (val: string) => {
    const opt = options.find((o) => o.value === val);
    if (opt?.disabled) return; // opción bloqueada: no seleccionable
    if (isMulti) {
      const cur = new Set(props.value ?? []);
      if (cur.has(val)) cur.delete(val);
      else cur.add(val);
      props.onChange(Array.from(cur));
    } else {
      props.onChange(val);
    }
  };

  return (
    <div
      role={isMulti ? "group" : "radiogroup"}
      className={cn("grid gap-1.5", COLS_MAP[columns], className)}
    >
      {options.map((opt) => {
        const selected = selectedSet.has(opt.value);
        const optDisabled = disabled || opt.disabled;
        return (
          <button
            key={opt.value}
            type="button"
            role={isMulti ? "checkbox" : "radio"}
            aria-checked={selected}
            aria-disabled={optDisabled}
            disabled={optDisabled}
            title={opt.disabled ? "No disponible" : undefined}
            onClick={() => toggle(opt.value)}
            className={cn(
              "relative flex flex-col items-center justify-center rounded-md border font-medium leading-tight transition-all",
              SIZE_MAP[size],
              selected
                ? "border-[var(--brand-cyan)] bg-[rgba(0,229,255,0.08)] text-white shadow-[0_2px_10px_-4px_rgba(0,229,255,0.35)]"
                : "border-white/10 bg-white/[0.02] text-white/85 hover:border-[rgba(0,229,255,0.35)] hover:bg-[rgba(0,229,255,0.04)]",
              optDisabled && "cursor-not-allowed opacity-50",
              opt.disabled && "line-through decoration-white/40"
            )}
          >
            <span className="leading-tight">{opt.label}</span>
            {opt.hint && (
              <span className="mt-0.5 text-[8.5px] font-normal uppercase tracking-[0.06em] text-white/45 leading-tight">
                {opt.disabled ? "No disponible" : opt.hint}
              </span>
            )}
            {selected && (
              <span className="absolute right-1 top-1 text-[var(--brand-cyan)]">
                <svg
                  viewBox="0 0 24 24"
                  className="h-2.5 w-2.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
