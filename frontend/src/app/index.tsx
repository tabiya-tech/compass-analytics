import { createHashRouter, Navigate, RouterProvider } from "react-router-dom";
import ProtectedRoute, { PermissionRoute } from "@/app/ProtectedRoute/ProtectedRoute";
import { Layout } from "@/app/Layout";
import { routerPaths } from "@/app/routerPaths";
import { Action, Subject } from "@/access/AccessContext";
import { Login } from "@/pages/Login/Login";
import { Register } from "@/pages/Register/Register";
import { Overview } from "@/pages/Overview/Overview";
import { Institutions } from "@/pages/Institutions";

const router = createHashRouter([
  {
    path: routerPaths.LOGIN,
    element: <Login />,
  },
  {
    path: routerPaths.REGISTER,
    element: <Register />,
  },
  {
    path: routerPaths.ROOT,
    element: <Layout />,
    children: [
      {
        index: true,
        element: (
          <PermissionRoute action={Action.View} subject={Subject.Dashboard}>
            <Overview />
          </PermissionRoute>
        ),
      },
      {
        path: routerPaths.JOBSEEKERS,
        element: <ProtectedRoute>Jobseekers</ProtectedRoute>,
      },
      {
        path: routerPaths.INSTITUTIONS,
        element: (
          <PermissionRoute action={Action.View} subject={Subject.Institutions}>
            <Institutions />
          </PermissionRoute>
        ),
      },
      {
        path: routerPaths.USER_ACCESS,
        element: (
          <PermissionRoute action={Action.Manage} subject={Subject.AccessManagement}>
            User Access
          </PermissionRoute>
        ),
      },
      {
        path: routerPaths.MODULES,
        element: <ProtectedRoute>Modules</ProtectedRoute>,
      },
      {
        path: routerPaths.MODULE,
        element: <ProtectedRoute>Module</ProtectedRoute>,
      },
      {
        path: routerPaths.SETTINGS,
        element: <ProtectedRoute>Settings</ProtectedRoute>,
      },
    ],
  },
  {
    path: "*",
    element: <Navigate to={routerPaths.ROOT} replace />,
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
