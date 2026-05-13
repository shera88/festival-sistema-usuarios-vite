export function LoadingSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-20 rounded-2xl border border-glass-border bg-glass-bg animate-pulse"
        />
      ))}
    </div>
  );
}
