import type { User } from '@/types/domain';

interface Props {
  user: User;
}

export function UserHero({ user }: Props) {
  const initial = (user.nombre_y_apellido || '?').charAt(0).toUpperCase();
  const rol = user.rol_primario
    ? user.rol_primario.charAt(0).toUpperCase() + user.rol_primario.slice(1)
    : 'Contacto';
  const inst = user.nombre_agrupacion || 'Sin institución';

  return (
    <div
      className="relative flex items-center gap-6 overflow-hidden border-b border-glass-border px-4 py-6 sm:px-8"
      style={{
        background:
          'linear-gradient(135deg, rgba(14, 9, 40, 0.8) 0%, rgba(18, 10, 48, 0.5) 100%)',
      }}
    >
      <div
        className="pointer-events-none absolute -right-[20%] -top-[50%] h-[300px] w-[300px]"
        style={{
          background:
            'radial-gradient(ellipse 60% 60% at 50% 50%, rgba(0, 229, 255, 0.08), transparent 70%)',
        }}
      />

      <div
        className="relative z-10 h-16 w-16 shrink-0 overflow-hidden rounded-full border-[3px] border-cyan"
        style={{
          background: 'var(--bg-elevated)',
          boxShadow: '0 0 24px rgba(0, 229, 255, 0.2)',
        }}
      >
        {user.imagen_contacto ? (
          <img
            src={user.imagen_contacto}
            alt={user.nombre_y_apellido}
            className="h-full w-full object-cover"
            onError={(e) => {
              const target = e.currentTarget;
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent) {
                parent.innerHTML = `<div class="h-full w-full flex items-center justify-center text-white font-display font-bold text-2xl" style="background:linear-gradient(135deg,var(--cyan),var(--fuchsia))">${initial}</div>`;
              }
            }}
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center font-display text-2xl font-bold text-white"
            style={{ background: 'linear-gradient(135deg, var(--cyan), var(--fuchsia))' }}
          >
            {initial}
          </div>
        )}
      </div>

      <div className="relative z-10 min-w-0 flex-1">
        <div className="truncate font-display text-lg font-light gradient-text-cf">
          {user.nombre_y_apellido}
        </div>
        <div
          className="mt-1 truncate text-[11px] uppercase text-text-45"
          style={{ letterSpacing: '0.5px' }}
        >
          {rol} • {inst}
        </div>
      </div>
    </div>
  );
}
