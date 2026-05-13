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
    <div className="flex items-center gap-4 border-b border-glass-border px-4 py-5">
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border border-glass-border">
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
                parent.innerHTML = `<div class="h-full w-full flex items-center justify-center text-white font-semibold text-xl" style="background:linear-gradient(135deg,var(--cyan),var(--fuchsia))">${initial}</div>`;
              }
            }}
          />
        ) : (
          <div
            className="h-full w-full flex items-center justify-center text-white font-semibold text-xl"
            style={{ background: 'linear-gradient(135deg,var(--cyan),var(--fuchsia))' }}
          >
            {initial}
          </div>
        )}
      </div>
      <div className="min-w-0">
        <div className="text-text-90 font-semibold truncate">{user.nombre_y_apellido}</div>
        <div className="text-text-45 text-xs truncate">
          {rol} • {inst}
        </div>
      </div>
    </div>
  );
}
