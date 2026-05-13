import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AppHeader } from '@/components/layout/AppHeader';
import { UserHero } from '@/components/layout/UserHero';
import { TabsNav } from '@/components/layout/TabsNav';
import { InscripcionesTab } from './tabs/InscripcionesTab';
import { KardexTab } from './tabs/KardexTab';
import { CalificacionesTab } from './tabs/CalificacionesTab';
import { VideosTab } from './tabs/VideosTab';
import { PagosTab } from './tabs/PagosTab';
import { InscripcionPage } from './InscripcionPage';
import { KardexFormPage } from './KardexFormPage';
import { SolicitudPage } from './SolicitudPage';

const FORM_PATHS = ['/inscripcion', '/kardex-form', '/solicitud'];

export function DashboardPage() {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return null;

  const isFormPage = FORM_PATHS.some((p) => location.pathname.startsWith(p));

  return (
    <div className="min-h-screen pb-12">
      <AppHeader />
      {!isFormPage && (
        <>
          <UserHero user={user} />
          <TabsNav />
        </>
      )}
      <main className="w-full">
        <Routes>
          <Route index element={<Navigate to="/inscripciones" replace />} />
          <Route path="inscripciones" element={<InscripcionesTab />} />
          <Route path="kardex" element={<KardexTab />} />
          <Route path="calificaciones" element={<CalificacionesTab />} />
          <Route path="videos" element={<VideosTab />} />
          <Route path="pagos" element={<PagosTab />} />
          <Route path="inscripcion" element={<InscripcionPage />} />
          <Route path="kardex-form" element={<KardexFormPage />} />
          <Route path="solicitud" element={<SolicitudPage />} />
          <Route path="*" element={<Navigate to="/inscripciones" replace />} />
        </Routes>
      </main>
    </div>
  );
}
