interface Stat {
  label: string;
  value: string | number;
  accent?: 'cyan' | 'fuchsia' | 'gold';
}

export function StatsCards({ stats }: { stats: Stat[] }) {
  if (stats.length === 0) return null;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {stats.map((s) => (
        <div
          key={s.label}
          className="rounded-2xl border border-glass-border bg-glass-bg backdrop-blur-md p-4"
        >
          <div className="text-[10px] uppercase tracking-wider text-text-45">{s.label}</div>
          <div
            className={`mt-1 text-3xl font-bold ${
              s.accent === 'cyan'
                ? 'text-cyan'
                : s.accent === 'fuchsia'
                  ? 'text-fuchsia'
                  : s.accent === 'gold'
                    ? 'text-gold'
                    : 'text-text-90'
            }`}
          >
            {s.value}
          </div>
        </div>
      ))}
    </div>
  );
}
