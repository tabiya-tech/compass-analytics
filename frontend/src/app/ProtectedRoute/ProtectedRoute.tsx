import { Navigate } from "react-router-dom";
import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/auth/AuthContext";
import { useAbility, type Action, type Subject, type AppAbility } from "@/access/AccessContext";
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

interface PermissionRouteProps {
  action: Action;
  subject: Subject;
  children: ReactNode;
}

export function PermissionRoute({ action, subject, children }: Readonly<PermissionRouteProps>) {
  const { user, loading } = useAuth();
  const ability = useAbility<AppAbility>();
  const { t } = useTranslation();

  if (loading) return null;
  if (!user) return <Navigate to={routerPaths.LOGIN} replace />;
  if (!ability.can(action, subject)) return <div role="alert">{t("access.notAuthorised")}</div>;
  return <>{children}</>;
}
