import { Navigate } from 'react-router-dom';
import { SystemRoles } from 'librechat-data-provider';
import type { ReactNode } from 'react';
import { useAuthContext } from '~/hooks/AuthContext';

export default function AdminGuard({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuthContext();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  if (user?.role !== SystemRoles.ADMIN) {
    return <Navigate to="/c/new" replace />;
  }
  return <>{children}</>;
}
