import { createBrowserRouter } from "react-router-dom";
import PublicLayout from "./routes/public-layout";
import LoginPage from "./routes/public-layout/login";
import RegisterPage from "./routes/public-layout/register";
import ProtectedLayout from "./routes/protected-layout";
import DashboardPage from "./routes/protected-layout/dashboard";
import CreatePage from "./routes/protected-layout/create";
import UpdatePage from "./routes/protected-layout/update";
import ProfilePage from "./routes/protected-layout/profile";
import AuditLogPage from "./routes/protected-layout/audit-log";

const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      {
        index: true,
        element: <LoginPage />,
      },
      {
        path: "/register",
        element: <RegisterPage />,
      },
    ],
  },
  {
    element: <ProtectedLayout />,
    children: [
      {
        path: "/dashboard",
        element: <DashboardPage />,
      },
      {
        path: "/create",
        element: <CreatePage />,
      },
      {
        path: "/update",
        element: <UpdatePage />,
      },
      {
        path: "/profile",
        element: <ProfilePage />,
      },
      {
        path: "/audit-log",
        element: <AuditLogPage />,
      },
    ],
  },
]);

export default router;