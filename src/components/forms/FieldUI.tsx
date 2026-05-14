import { forwardRef, type ReactNode, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';

interface BaseProps {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
}

export function FieldWrap({
  label,
  required,
  hint,
  error,
  children,
}: BaseProps & { children: ReactNode }) {
  return (
    <div>
      <label
        className="mb-2 block text-[11px] font-medium uppercase text-text-65"
        style={{ letterSpacing: '0.5px' }}
      >
        {label}
        {required && <span className="ml-1 text-fuchsia">*</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-[11px] text-text-45">{hint}</p>}
      {error && <p className="mt-1.5 text-[11px] text-red-400">{error}</p>}
    </div>
  );
}

type TextProps = InputHTMLAttributes<HTMLInputElement> & BaseProps;

export const FieldText = forwardRef<HTMLInputElement, TextProps>(function FieldText(
  { label, required, hint, error, className, ...rest },
  ref,
) {
  return (
    <FieldWrap label={label} required={required} hint={hint} error={error}>
      <input
        ref={ref}
        {...rest}
        className={`w-full rounded-xl border bg-elev px-4 py-3 text-[14px] text-text-90 placeholder:text-text-45 outline-none transition focus:border-cyan focus:ring-2 focus:ring-cyan/20 disabled:cursor-not-allowed disabled:opacity-60 ${
          error ? 'border-red-500/50' : 'border-glass-border'
        } ${className ?? ''}`}
      />
    </FieldWrap>
  );
});

type AreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & BaseProps;

export const FieldTextarea = forwardRef<HTMLTextAreaElement, AreaProps>(function FieldTextarea(
  { label, required, hint, error, className, ...rest },
  ref,
) {
  return (
    <FieldWrap label={label} required={required} hint={hint} error={error}>
      <textarea
        ref={ref}
        rows={rest.rows ?? 4}
        {...rest}
        className={`w-full rounded-xl border bg-elev px-4 py-3 text-[14px] text-text-90 placeholder:text-text-45 outline-none transition focus:border-cyan focus:ring-2 focus:ring-cyan/20 ${
          error ? 'border-red-500/50' : 'border-glass-border'
        } ${className ?? ''}`}
      />
    </FieldWrap>
  );
});

type SelectProps = InputHTMLAttributes<HTMLSelectElement> & BaseProps & {
  options: readonly { value: string; label: string }[] | { value: string; label: string }[];
  placeholder?: string;
};

export const FieldSelect = forwardRef<HTMLSelectElement, SelectProps>(function FieldSelect(
  { label, required, hint, error, options, placeholder = 'Seleccione…', ...rest },
  ref,
) {
  return (
    <FieldWrap label={label} required={required} hint={hint} error={error}>
      <select
        ref={ref}
        {...rest}
        className={`w-full rounded-xl border bg-elev px-4 py-3 text-[14px] text-text-90 outline-none transition focus:border-cyan focus:ring-2 focus:ring-cyan/20 ${
          error ? 'border-red-500/50' : 'border-glass-border'
        }`}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldWrap>
  );
});
