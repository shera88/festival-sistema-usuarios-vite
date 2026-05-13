import { useState } from 'react';
import { YearPills } from '@/components/filters/YearPills';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatsCards } from '@/components/shared/StatsCards';
import type { Year } from '@/types/domain';

const YEARS = ['2023', '2024', '2025', '2026'] as const satisfies readonly Year[];

export function PagosTab() {
  const [year, setYear] = useState<Year>('2026');

  const stats = [
    { label: 'Pagos Registrados', value: '—', accent: 'cyan' as const },
    { label: 'Monto Total', value: '—', accent: 'fuchsia' as const },
    { label: 'Próximos', value: '—', accent: 'gold' as const },
  ];

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <StatsCards stats={stats} />

      <div className="space-y-3 rounded-2xl border border-glass-border bg-glass-bg p-4 backdrop-blur-md">
        <div className="text-[10px] uppercase text-text-45" style={{ letterSpacing: '1px' }}>
          Filtrar por año
        </div>
        <YearPills years={YEARS} value={year} onChange={setYear} />
      </div>

      <EmptyState>Próximamente — módulo de pagos en desarrollo.</EmptyState>
    </div>
  );
}
