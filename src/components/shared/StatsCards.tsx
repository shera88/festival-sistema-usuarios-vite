interface Stat {
  label: string;
  value: string | number;
  accent?: 'cyan' | 'fuchsia' | 'gold' | 'purple' | 'green';
}

export function StatsCards({ stats }: { stats: Stat[] }) {
  if (stats.length === 0) return null;
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {stats.map((s) => (
        <div
          key={s.label}
          className="card-depth flex flex-col justify-between gap-0.5 rounded-lg px-2.5 py-2"
        >
          <div
            className="text-[8px] font-medium uppercase leading-[1.25] text-text-45 line-clamp-2 min-h-[1.875rem]"
            style={{ letterSpacing: '0.6px' }}
          >
            {s.label}
          </div>
          <div
            className="font-display text-[14px] font-thin leading-none tabular-nums"
            style={{ color: 'var(--cyan)', letterSpacing: '-0.01em' }}
          >
            {s.value}
          </div>
        </div>
      ))}
    </div>
  );
}
