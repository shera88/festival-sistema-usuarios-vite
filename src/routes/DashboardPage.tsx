import { useAuth } from '@/hooks/useAuth';

export function DashboardPage() {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-glass-border px-4 py-3">
        <h1 className="text-text-90 font-semibold">Mi Cuenta</h1>
        <button
          onClick={() => logout()}
          className="rounded-lg border border-glass-border px-3 py-1.5 text-sm text-text-90 hover:bg-glass-bg"
        >
          Salir
        </button>
      </header>
      <main className="p-6">
        <p className="text-text-90">
          Bienvenido, <strong>{user.nombre_y_apellido}</strong>
        </p>
        <p className="text-text-45 text-sm mt-1">
          {user.rol_primario} • {user.nombre_agrupacion}
        </p>
        <p className="mt-6 text-text-45 text-sm italic">
          Tabs (Inscripciones, Kardex, Calificaciones, Videos, Pagos) próximo chunk.
        </p>
      </main>
    </div>
  );
}
