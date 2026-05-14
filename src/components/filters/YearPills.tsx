interface Props<T extends string> {
  years: readonly T[];
  value: T;
  onChange: (year: T) => void;
}

export function YearPills<T extends string>({ years, value, onChange }: Props<T>) {
  return (
    <div className="grid grid-cols-4 gap-1.5 sm:flex sm:flex-wrap sm:gap-2">
      {years.map((y) => {
        const active = y === value;
        return (
          <button
            key={y}
            type="button"
            onClick={() => onChange(y)}
            className={
              active
                ? 'rounded-full bg-[linear-gradient(135deg,var(--cyan),var(--fuchsia))] px-2 py-1.5 text-xs font-semibold text-white shadow sm:px-4'
                : 'rounded-full border border-glass-border bg-glass-bg px-2 py-1.5 text-xs text-text-45 hover:border-cyan/40 hover:text-text-90 sm:px-4'
            }
          >
            {y}
          </button>
        );
      })}
    </div>
  );
}
