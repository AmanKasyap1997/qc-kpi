import ProtectedRoute from "@/components/shared/ProtectedRoute";
import { createBrowserRouter, redirect  } from "react-router-dom";
import PublicLayout from "../layouts/PublicLayout";
import DashboardPage from "../pages/dashboard";
// import DncTablePage from "../pages/dnc/DncTablePageV2";
import ForgotPassword from "../pages/ForgotPassword";
import Login from "../pages/Login";
import ResetPassword from "../pages/ResetPassword";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: PublicLayout,
    children: [
      // { index: true, Component: AuthRedirect },
      { index: true, Component: Login },
      { path: "login", Component: Login },
      { path: "forgot-password", Component: ForgotPassword },
      { path: "reset-password", Component: ResetPassword },
    ],
  },
  {
    path: "/",
    Component: ProtectedRoute,
    // Component: ProtectedLayout,
    children: [
      { path: "dashboard", Component: DashboardPage },

      // catch all routes and redirect to dashboard.
      {
      path: "dashboard/*",
      loader: () => redirect("/dashboard"),
    },
    ],
  },
]);
