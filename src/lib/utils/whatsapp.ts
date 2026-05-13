export function whatsappLink(tel: string | null | undefined): string | null {
  const num = String(tel ?? '').replace(/\D/g, '');
  if (!num) return null;
  const full = num.length === 8 ? `591${num}` : num;
  return `https://wa.me/${full}`;
}
