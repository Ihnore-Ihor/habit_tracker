import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProtectedRoute({ children, allow }) {
  const { isAuthenticated, role } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return (
      <Navigate to="/auth/login" replace state={{ from: location }} />
    );
  }

  if (allow && allow.length > 0 && !allow.includes(role)) {
    return <Navigate to="/forbidden" replace />;
  }

  return children;
}
