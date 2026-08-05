import { createHashRouter, Navigate, RouterProvider } from "react-router-dom";
import { ProtectedRoute } from "@/app/ProtectedRoute";
import { Layout } from "@/app/Layout";
import { routerPaths } from "@/app/routerPaths";
import { Login } from "@/pages/Login";
import { Register } from "@/pages/Register";
import { Overview } from "@/pages/Overview/Overview";

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
          <ProtectedRoute>
            <Overview />
          </ProtectedRoute>
        ),
      },
      {
        path: routerPaths.JOBSEEKERS,
        element: <ProtectedRoute>Jobseekers</ProtectedRoute>,
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
