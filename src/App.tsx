import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import { MobileHome, MobilePart } from './pages/Mobile';

const Splash = () => <div className="flex min-h-screen items-center justify-center text-slate-500">Loading…</div>;

function RequireAuth({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { session, profile, loading, isAdmin } = useAuth();
  if (loading || (session && !profile)) return <Splash />;
  if (!session) return <Navigate to="/login" replace />;
  if (admin && !isAdmin) return <Navigate to="/m" replace />;
  return <>{children}</>;
}

function Home() {
  const { session, isAdmin, loading, profile } = useAuth();
  if (loading || (session && !profile)) return <Splash />;
  if (!session) return <Navigate to="/login" replace />;
  // Admins on a wide screen land on the dashboard; everyone else on the mechanic view.
  return <Navigate to={isAdmin && window.innerWidth >= 1024 ? '/dashboard' : '/m'} replace />;
}

function LoginRoute() {
  const { session, loading } = useAuth();
  if (loading) return <Splash />;
  return session ? <Navigate to="/" replace /> : <Login />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<LoginRoute />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/m" element={<RequireAuth><MobileHome /></RequireAuth>} />
          <Route path="/m/part/:id" element={<RequireAuth><MobilePart /></RequireAuth>} />
          <Route path="/dashboard" element={<RequireAuth admin><Dashboard /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
