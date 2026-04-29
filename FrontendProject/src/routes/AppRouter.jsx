import { Routes, Route, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext.jsx';
import { ROLES } from '../context/AuthContext.jsx';
import ProtectedRoute from './ProtectedRoute.jsx';

import Login from '../pages/auth/Login.jsx';
import Register from '../pages/auth/Register.jsx';
import Dashboard from '../pages/Dashboard.jsx';
import Profile from '../pages/Profile.jsx';
import ContentManagerView from '../pages/ContentManagerView.jsx';
import AnalystDashboardView from '../pages/AnalystDashboardView.jsx';
import BodyMindPage from '../pages/BodyMindPage.jsx';
import StatsPage from '../pages/StatsPage.jsx';
import AchievementsPage from '../pages/AchievementsPage.jsx';
import NotFound from '../pages/NotFound.jsx';
import Forbidden from '../pages/Forbidden.jsx';

function RoleHome() {
  const { role } = useAuth();
  if (role === ROLES.CONTENT_MANAGER) return <Navigate to="/catalog" replace />;
  if (role === ROLES.ANALYST) return <Navigate to="/analytics" replace />;
  return <Navigate to="/dashboard" replace />;
}

export default function AppRouter() {
  return (
    <AnimatePresence mode="wait">
      <Routes>
        <Route path="/auth/login" element={<Login />} />
        <Route path="/auth/register" element={<Register />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allow={[ROLES.USER, ROLES.ANALYST, ROLES.CONTENT_MANAGER]}>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute allow={[ROLES.USER, ROLES.ANALYST, ROLES.CONTENT_MANAGER]}>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/body-mind"
          element={
            <ProtectedRoute allow={[ROLES.USER, ROLES.ANALYST, ROLES.CONTENT_MANAGER]}>
              <BodyMindPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/stats"
          element={
            <ProtectedRoute allow={[ROLES.USER, ROLES.ANALYST, ROLES.CONTENT_MANAGER]}>
              <StatsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/achievements"
          element={
            <ProtectedRoute allow={[ROLES.USER, ROLES.ANALYST, ROLES.CONTENT_MANAGER]}>
              <AchievementsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/catalog"
          element={
            <ProtectedRoute allow={[ROLES.CONTENT_MANAGER, ROLES.ANALYST]}>
              <ContentManagerView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/analytics"
          element={
            <ProtectedRoute allow={[ROLES.ANALYST, ROLES.CONTENT_MANAGER]}>
              <AnalystDashboardView />
            </ProtectedRoute>
          }
        />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <RoleHome />
            </ProtectedRoute>
          }
        />

        <Route path="/forbidden" element={<Forbidden />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AnimatePresence>
  );
}
