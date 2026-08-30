import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useGanadores } from '@/hooks/queries';
import { GanadoresView } from '@/components/resultados/GanadoresView';

/**
 * Ganadores en el portal de PARTICIPANTES, hoy sólo para super admin.
 *
 * No confundir con Nominados: allá el lugar y la nota se esconden a propósito y
 * el orden va mezclado, porque esa lista se muestra afuera. Aquí se ve todo.
 *
 * La guarda de verdad está en el servidor (ganadores.php → requireSuperAdmin);
 * ésta sólo evita mostrar una pestaña que daría 403. Todo lo que se ve vive en
 * GanadoresView, que comparte con el área de clientes.
 */
export function GanadoresTab() {
  const { user } = useAuth();
  if (!user?.es_super_admin) return <Navigate to="/calificaciones" replace />;
  return <GanadoresContent />;
}

function GanadoresContent() {
  const { data, isLoading, error } = useGanadores(true);

  return (
    <GanadoresView
      bloques={data?.bloques ?? []}
      cuadros={data?.absolutos ?? []}
      total={data?.total ?? 0}
      cargando={isLoading}
      error={!!error}
      verDetalle
    />
  );
}
