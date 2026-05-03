import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { router } from '@/lib/router/routes';
import { queryClient } from '@/lib/api/queryClient';
import { useBootstrapAuth } from '@/lib/auth/useAuth';
import { ErrorBoundary } from '@/components/ErrorBoundary';

function BootstrappedRouter() {
  const { ready } = useBootstrapAuth();
  // Simple gate to avoid a 401-redirect flash while the silent refresh is
  // in flight. Plain div keeps the initial bundle light; no spinner library.
  if (!ready) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'var(--bg)',
          display: 'grid',
          placeItems: 'center',
          color: 'var(--ink-3)',
          fontSize: 13,
        }}
      >
        Connexion…
      </div>
    );
  }
  return <RouterProvider router={router} />;
}

export default function App() {
  return (
    <ErrorBoundary contextLabel="careplus — application principale">
      <QueryClientProvider client={queryClient}>
        <BootstrappedRouter />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              fontFamily: 'var(--font-sans)',
              borderRadius: 'var(--r-md)',
            },
          }}
        />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
