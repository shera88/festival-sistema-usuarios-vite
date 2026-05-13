import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AppHeader } from '@/components/layout/AppHeader';
import { UserHero } from '@/components/layout/UserHero';
import { TabsNav } from '@/components/layout/TabsNav';
import { InscripcionesTab } from './tabs/InscripcionesTab';
import { KardexTab } from './tabs/KardexTab';
import { CalificacionesTab } from './tabs/CalificacionesTab';
import { VideosTab } from './tabs/VideosTab';
import { PagosTab } from './tabs/PagosTab';

export function DashboardPage() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="min-h-screen pb-12">
      <AppHeader />
      <UserHero user={user} />
      <TabsNav />
      <main className="mx-auto max-w-5xl">
        <Routes>
          <Route index element={<Navigate to="/inscripciones" replace />} />
          <Route path="inscripciones" element={<InscripcionesTab />} />
          <Route path="kardex" element={<KardexTab />} />
          <Route path="calificaciones" element={<CalificacionesTab />} />
          <Route path="videos" element={<VideosTab />} />
          <Route path="pagos" element={<PagosTab />} />
          <Route path="*" element={<Navigate to="/inscripciones" replace />} />
        </Routes>
      </main>
    </div>
  );
}
