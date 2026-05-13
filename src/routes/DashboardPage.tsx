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

const FORM_PATHS = new Set(['/inscripcion', '/kardex-form', '/solicitud']);

export function DashboardPage() {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return null;

  const isFormPage = FORM_PATHS.has(location.pathname);

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      {!isFormPage && (
        <>
          <UserHero user={user} />
          <TabsNav />
        </>
      )}
      <main className="mx-auto w-full max-w-7xl flex-1">
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
      <footer
        className="border-t border-glass-border p-4 text-center text-xs text-text-25"
        style={{ letterSpacing: '0.3px' }}
      >
        &copy; 2026 Festival DanzArte. Todos los derechos reservados.
      </footer>
    </div>
  );
}
