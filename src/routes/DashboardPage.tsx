import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useRealtime } from '@/hooks/useRealtime';
import { AppHeader } from '@/components/layout/AppHeader';
import { UserHero } from '@/components/layout/UserHero';
import { TabsNav } from '@/components/layout/TabsNav';
import { BottomNav } from '@/components/layout/BottomNav';
import { InscripcionesTab } from './tabs/InscripcionesTab';
import { KardexTab } from './tabs/KardexTab';
import { CalificacionesTab } from './tabs/CalificacionesTab';
import { ProgramaTab } from './tabs/ProgramaTab';
import { VideosTab } from './tabs/VideosTab';
import { PagosTab } from './tabs/PagosTab';

// Lazy: forms cargan supabase client + base-ui + autocompletes (~150KB).
// Diferirlos baja el bundle inicial del dashboard.
const InscripcionPage = lazy(() =>
  import('./InscripcionPage').then((m) => ({ default: m.InscripcionPage })),
);
const KardexFormPage = lazy(() =>
  import('./KardexFormPage').then((m) => ({ default: m.KardexFormPage })),
);
const SolicitudPage = lazy(() =>
  import('./SolicitudPage').then((m) => ({ default: m.SolicitudPage })),
);
const PerfilPage = lazy(() =>
  import('./PerfilPage').then((m) => ({ default: m.PerfilPage })),
);
const AdminPagosTab = lazy(() =>
  import('./tabs/AdminPagosTab').then((m) => ({ default: m.AdminPagosTab })),
);

function RouteFallback() {
  return (
    <div className="flex items-center justify-center py-24 text-text-45 text-[12px]">
      Cargando…
    </div>
  );
}

const FORM_PATHS = new Set(['/inscripcion', '/kardex-form', '/solicitud', '/perfil']);

export function DashboardPage() {
  const { user } = useAuth();
  const location = useLocation();
  useRealtime();
  if (!user) return null;

  const isFormPage = FORM_PATHS.has(location.pathname);

  return (
    <div className={`flex min-h-screen flex-col ${!isFormPage ? 'pb-14 lg:pb-0' : ''}`}>
      <AppHeader />
      {!isFormPage && (
        <>
          <UserHero user={user} />
          <TabsNav />
        </>
      )}
      <main className="w-full flex-1 px-3 sm:px-6 lg:px-8">
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route index element={<Navigate to="/inscripciones" replace />} />
            <Route path="inscripciones" element={<InscripcionesTab />} />
            <Route path="kardex" element={<KardexTab />} />
            <Route path="calificaciones" element={<CalificacionesTab />} />
            <Route path="programa" element={<ProgramaTab />} />
            <Route path="videos" element={<VideosTab />} />
            <Route path="pagos" element={<PagosTab />} />
            <Route path="admin/pagos" element={<AdminPagosTab />} />
            <Route path="inscripcion" element={<InscripcionPage />} />
            <Route path="kardex-form" element={<KardexFormPage />} />
            <Route path="solicitud" element={<SolicitudPage />} />
            <Route path="perfil" element={<PerfilPage />} />
            <Route path="*" element={<Navigate to="/inscripciones" replace />} />
          </Routes>
        </Suspense>
      </main>
      <footer
        className="border-t border-glass-border p-4 text-center text-xs text-text-25"
        style={{ letterSpacing: '0.3px' }}
      >
        &copy; 2026 Festival Danzarte. Todos los derechos reservados.
      </footer>
      {!isFormPage && <BottomNav />}
    </div>
  );
}
