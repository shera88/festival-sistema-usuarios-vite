// Un color distinto por día del festival, para las etiquetas de día.
const DAY_CHIP: Record<string, string> = {
  MARTES: 'text-cyan border-cyan/40 bg-cyan/10',
  MIERCOLES: 'text-fuchsia border-fuchsia/40 bg-fuchsia/10',
  'MIÉRCOLES': 'text-fuchsia border-fuchsia/40 bg-fuchsia/10',
  JUEVES: 'text-gold border-gold/40 bg-gold/10',
  VIERNES: 'text-[#10B981] border-[#10B981]/40 bg-[#10B981]/10',
  SABADO: 'text-[#A78BFA] border-[#A78BFA]/40 bg-[#A78BFA]/10',
  'SÁBADO': 'text-[#A78BFA] border-[#A78BFA]/40 bg-[#A78BFA]/10',
  DOMINGO: 'text-[#FB923C] border-[#FB923C]/40 bg-[#FB923C]/10',
};

const NEUTRO = 'text-text-45 border-glass-border bg-white/5';

export function dayChipClasses(dia?: string | null): string {
  return DAY_CHIP[(dia || '').trim().toUpperCase()] ?? NEUTRO;
}

export function dayLabel(dia?: string | null): string {
  const d = (dia || '').trim();
  if (!d) return 'Sin día';
  return d.charAt(0).toUpperCase() + d.slice(1).toLowerCase();
}
