import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/hooks/AuthProvider';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { ClienteAuthProvider } from '@/hooks/ClienteAuthProvider';
import { ClienteGuard } from '@/components/auth/ClienteGuard';
import { ClienteLoginPage } from '@/routes/ClienteLoginPage';
import { ClienteRegistroPage } from '@/routes/ClienteRegistroPage';
import { ClienteShell } from '@/routes/clientes/ClienteShell';
import { ClienteVideosPage } from '@/routes/clientes/ClienteVideosPage';
import { ClienteNominadosPage } from '@/routes/clientes/ClienteNominadosPage';
import { ClienteGanadoresPage } from '@/routes/clientes/ClienteGanadoresPage';
import { LoginPage } from '@/routes/LoginPage';
import { DashboardPage } from '@/routes/DashboardPage';
import { UpdateBanner } from '@/components/shared/UpdateBanner';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Sin cache stale: cada navegación re-fetcha. Supabase Realtime invalida
      // automáticamente cuando hay cambios server-side.
      staleTime: 0,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <AuthProvider>
         <ClienteAuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/clientes/login" element={<ClienteLoginPage />} />
            <Route path="/clientes/registro" element={<ClienteRegistroPage />} />
            <Route
              path="/clientes"
              element={
                <ClienteGuard>
                  <ClienteShell />
                </ClienteGuard>
              }
            >
              <Route index element={<Navigate to="/clientes/videos" replace />} />
              <Route path="videos" element={<ClienteVideosPage />} />
              <Route path="nominados" element={<ClienteNominadosPage />} />
              <Route path="ganadores" element={<ClienteGanadoresPage />} />
            </Route>
            <Route
              path="/*"
              element={
                <AuthGuard>
                  <DashboardPage />
                </AuthGuard>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
         </ClienteAuthProvider>
          {createPortal(
            <Toaster theme="dark" position="top-right" style={{ zIndex: 2147483647 }} />,
            document.body,
          )}
          <UpdateBanner />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
