import { Navigate } from "react-router-dom";
import { type ReactNode } from "react";
import { useAuth } from "@/auth/AuthContext";
import { useAccess, type PermissionKey } from "@/access/AccessContext";
import { routerPaths } from "@/app/routerPaths";

interface ProtectedRouteProps {
  children: ReactNode;
  permission?: PermissionKey;
}

const ProtectedRoute = ({ children, permission }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const { hasPermission } = useAccess();

  if (loading) return null;
  if (!user) return <Navigate to={routerPaths.LOGIN} replace />;
  // Signed in but not granted this screen — back to the dashboard, not the login page.
  if (permission && !hasPermission(permission)) return <Navigate to={routerPaths.ROOT} replace />;
  return <>{children}</>;
};

export default ProtectedRoute;
