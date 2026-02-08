import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';
import { useAuthStore } from './stores/auth';
import { LoginPage } from './pages/Login';
import { DashboardPage } from './pages/Dashboard';
import { CapturePage } from './pages/Capture';
import { SessionPage } from './pages/Session';
import { Layout } from './components/Layout';
import { ToastContainer } from './components/Toast';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { authenticated, checking } = useAuthStore();

  React.useEffect(() => {
    useAuthStore.getState().check();
  }, []);

  if (checking) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!authenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <ToastContainer />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/*"
          element={
            <AuthGuard>
              <Layout>
                <Routes>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/capture" element={<CapturePage />} />
                  <Route path="/idea/:slug" element={<SessionPage />} />
                </Routes>
              </Layout>
            </AuthGuard>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
