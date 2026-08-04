import { Navigate } from "react-router-dom";
import { type ReactNode } from "react";
import { useAuth } from "@/auth/AuthContext";
import { routerPaths } from "@/app/routerPaths";

interface ProtectedRouteProps {
  children: ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to={routerPaths.LOGIN} replace />;
  return <>{children}</>;
};

export default ProtectedRoute;
