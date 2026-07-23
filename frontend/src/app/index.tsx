import { createHashRouter, Navigate, RouterProvider } from "react-router-dom";
import ProtectedRoute from "@/app/ProtectedRoute/ProtectedRoute";
import { routerPaths } from "@/app/routerPaths";
import { Layout } from "@/app/Layout";
import { HomePage } from "@/pages/HomePage";
import { Login } from "@/pages/Login/Login";
import { Register } from "@/pages/Register/Register";

const router = createHashRouter([
  {
    path: routerPaths.LOGIN,
    element: (
      <ProtectedRoute>
        <Login />
      </ProtectedRoute>
    ),
  },
  {
    path: routerPaths.REGISTER,
    element: (
      <ProtectedRoute>
        <Register />
      </ProtectedRoute>
    ),
  },
  {
    path: routerPaths.ROOT,
    element: <Layout />,
    children: [
      {
        index: true,
        element: (
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        ),
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
