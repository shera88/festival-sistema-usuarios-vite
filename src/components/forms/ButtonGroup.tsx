import { cn } from '@/lib/utils';

export type ButtonGroupOption = {
  value: string;
  label: string;
  hint?: string;
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
  options: readonly ButtonGroupOption[] | ButtonGroupOption[];
  columns?: 1 | 2 | 3 | 4 | 5 | 6;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  disabled?: boolean;
  /** Color de selección por sección (var CSS). Default: cyan */
  accent?: string;
};

type Props = CommonProps & (SingleProps | MultiProps);

const COLS_MAP: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-2 sm:grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-2 md:grid-cols-4',
  5: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-5',
  6: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-6',
};

const SIZE_MAP = {
  xs: 'px-2.5 py-2 text-[11px]',
  sm: 'px-3 py-2.5 text-[12px]',
  md: 'px-3.5 py-3 text-[13px]',
  lg: 'px-4 py-3.5 text-[14px]',
};

export function ButtonGroup(props: Props) {
  const {
    options,
    columns = 3,
    size = 'md',
    className,
    disabled,
    accent = 'var(--cyan)',
  } = props;
  const isMulti = props.multiple === true;
  const selectedSet = new Set(
    isMulti ? props.value ?? [] : props.value ? [props.value] : [],
  );

  const toggle = (val: string) => {
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
      role={isMulti ? 'group' : 'radiogroup'}
      className={cn('grid gap-2', COLS_MAP[columns], className)}
    >
      {options.map((opt) => {
        const selected = selectedSet.has(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            role={isMulti ? 'checkbox' : 'radio'}
            aria-checked={selected}
            disabled={disabled}
            onClick={() => toggle(opt.value)}
            className={cn(
              'relative flex flex-col items-center justify-center rounded-xl border font-medium leading-tight transition-all',
              SIZE_MAP[size],
              selected
                ? 'text-white font-semibold'
                : 'border-white/10 bg-white/[0.025] text-text-90 hover:border-white/25 hover:bg-white/[0.045]',
              disabled && 'cursor-not-allowed opacity-50',
            )}
            style={
              selected
                ? {
                    borderColor: accent,
                    background: `color-mix(in srgb, ${accent} 12%, transparent)`,
                    boxShadow: `0 4px 18px -6px ${accent}`,
                  }
                : undefined
            }
          >
            <span className="leading-tight">{opt.label}</span>
            {opt.hint && (
              <span
                className="mt-0.5 text-[9px] font-normal uppercase tracking-[0.08em] text-text-45 leading-tight"
                style={selected ? { color: 'rgba(255,255,255,0.65)' } : undefined}
              >
                {opt.hint}
              </span>
            )}
            {selected && (
              <span className="absolute right-1.5 top-1.5" style={{ color: accent }}>
                <svg
                  viewBox="0 0 24 24"
                  className="h-3 w-3"
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
