export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-glass-border bg-glass-bg px-6 py-12 text-center text-text-45 italic">
      {children}
    </div>
  );
}
