import { useState } from 'react';
import { YearPills } from '@/components/filters/YearPills';
import { EmptyState } from '@/components/shared/EmptyState';
import type { Year } from '@/types/domain';

const YEARS = ['2023', '2024', '2025', '2026'] as const satisfies readonly Year[];

export function PagosTab() {
  const [year, setYear] = useState<Year>('2026');

  return (
    <div className="space-y-4 p-4">
      <div className="space-y-2">
        <div className="text-xs uppercase text-text-45 tracking-wide">Filtrar por año</div>
        <YearPills years={YEARS} value={year} onChange={setYear} />
      </div>
      <EmptyState>Próximamente — módulo de pagos en desarrollo.</EmptyState>
    </div>
  );
}
