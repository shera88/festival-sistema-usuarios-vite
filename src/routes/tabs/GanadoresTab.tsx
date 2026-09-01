import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useGanadores } from '@/hooks/queries';
import { GanadoresView } from '@/components/resultados/GanadoresView';

/**
 * Ganadores en el portal de PARTICIPANTES.
 *
 * No confundir con Nominados: allá el lugar y la nota se esconden a propósito y
 * el orden va mezclado, porque esa lista se muestra afuera. Aquí se ve todo.
 *
 * Quién entra: el super admin siempre, y todo participante desde que la
 * organización publique los resultados. Esa bandera la decide el SERVIDOR
 * (_lib/publicacion.php) y llega por me.php como `ganadores_publicados` — acá
 * sólo se lee, para no tener dos interruptores que se puedan desincronizar.
 *
 * La guarda de verdad está en el servidor (ganadores.php); ésta sólo evita
 * mostrar una pantalla que daría 403. Tiene que decir EXACTAMENTE lo mismo que
 * la condición de las tres barras de navegación: si aquí dijera menos, la
 * pestaña aparecería y al pulsarla rebotaría a Calificaciones.
 */
export function GanadoresTab() {
  const { user } = useAuth();
  const puedeVer = !!user?.es_super_admin || !!user?.ganadores_publicados;
  if (!puedeVer) return <Navigate to="/calificaciones" replace />;
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
      /* El desglose por jurado se ve igual que lo ve un super admin: la
         organización lo pidió así. ganador-detalle.php se abre con la MISMA
         bandera, de modo que este botón nunca queda ofreciendo un 403. */
      verDetalle
    />
  );
}
