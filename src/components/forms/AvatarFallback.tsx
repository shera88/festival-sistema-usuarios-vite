interface Props {
  name: string;
  size?: number;
  rounded?: 'full' | 'md';
  className?: string;
}

const GRADIENTS = [
  ['#00E5FF', '#7C3AED'],
  ['#FF1FA8', '#7C3AED'],
  ['#E8D098', '#FF1FA8'],
  ['#10B981', '#00E5FF'],
  ['#7C3AED', '#FF1FA8'],
  ['#FBBF24', '#FF1FA8'],
  ['#60A5FA', '#7C3AED'],
];

function pickGradient(name: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  const idx = Math.abs(hash) % GRADIENTS.length;
  return GRADIENTS[idx] as [string, string];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function AvatarFallback({ name, size = 36, rounded = 'md', className }: Props) {
  const [a, b] = pickGradient(name);
  const init = initials(name);
  const radius = rounded === 'full' ? '9999px' : '0.5rem';
  const fontSize = Math.max(10, Math.round(size * 0.38));
  return (
    <span
      aria-hidden
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: radius,
        background: `linear-gradient(135deg, ${a}, ${b})`,
        color: '#0E0928',
        fontWeight: 700,
        fontSize,
        letterSpacing: '0.5px',
        flexShrink: 0,
      }}
    >
      {init}
    </span>
  );
}
