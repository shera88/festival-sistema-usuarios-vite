import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/hooks/AuthProvider';
import { AuthGuard } from '@/components/auth/AuthGuard';
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
          <Routes>
            <Route path="/login" element={<LoginPage />} />
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
