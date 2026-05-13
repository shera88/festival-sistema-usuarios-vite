import type { ReactNode, InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

interface BaseProps {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
}

export function Field({
  label,
  error,
  hint,
  required,
  children,
}: BaseProps & { children: ReactNode }) {
  return (
    <div className="mb-4">
      <label
        className="mb-2 block text-[11px] font-medium uppercase text-text-65"
        style={{ letterSpacing: '0.5px' }}
      >
        {label}
        {required && <span className="ml-1 text-fuchsia">*</span>}
      </label>
      {children}
      {hint && !error && (
        <p className="mt-1 text-[11px] text-text-45">{hint}</p>
      )}
      {error && <p className="mt-1 text-[11px] text-red-400">{error}</p>}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & BaseProps;

export function TextField({ label, error, hint, required, ...rest }: InputProps) {
  return (
    <Field label={label} error={error} hint={hint} required={required}>
      <input
        {...rest}
        className={`w-full rounded-lg border bg-elev px-3.5 py-2.5 text-[14px] text-text-90 placeholder:text-text-45 outline-none transition focus:border-cyan focus:ring-1 focus:ring-cyan disabled:cursor-not-allowed disabled:opacity-50 ${
          error ? 'border-red-500/50' : 'border-glass-border'
        } ${rest.className ?? ''}`}
      />
    </Field>
  );
}

type SelectProps = InputHTMLAttributes<HTMLSelectElement> & BaseProps & {
  options: { value: string; label: string; hint?: string }[];
};

export function SelectField({
  label,
  error,
  hint,
  required,
  options,
  ...rest
}: SelectProps) {
  return (
    <Field label={label} error={error} hint={hint} required={required}>
      <select
        {...rest}
        className={`w-full rounded-lg border bg-elev px-3.5 py-2.5 text-[14px] text-text-90 outline-none transition focus:border-cyan focus:ring-1 focus:ring-cyan disabled:cursor-not-allowed disabled:opacity-50 ${
          error ? 'border-red-500/50' : 'border-glass-border'
        }`}
      >
        <option value="">Seleccionar...</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}{o.hint ? ` (${o.hint})` : ''}
          </option>
        ))}
      </select>
    </Field>
  );
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & BaseProps;

export function TextareaField({
  label,
  error,
  hint,
  required,
  ...rest
}: TextareaProps) {
  return (
    <Field label={label} error={error} hint={hint} required={required}>
      <textarea
        {...rest}
        className={`w-full rounded-lg border bg-elev px-3.5 py-2.5 text-[14px] text-text-90 placeholder:text-text-45 outline-none transition focus:border-cyan focus:ring-1 focus:ring-cyan ${
          error ? 'border-red-500/50' : 'border-glass-border'
        }`}
        rows={rest.rows ?? 3}
      />
    </Field>
  );
}
