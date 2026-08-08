import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { lazy, Suspense, type ReactNode } from "react";
import App from "@/App";
import { RequireAuth } from "@/components/guards/RequireAuth";
import { RequireCharacter } from "@/components/guards/RequireCharacter";
import { RequireCharacterless } from "@/components/guards/RequireCharacterless";
import { GuestOnly } from "@/components/guards/GuestOnly";
import { RequireAdmin } from "@/components/guards/RequireAdmin";

const HomeView = lazy(() => import("@/views/HomeView"));
const LoginView = lazy(() => import("@/views/LoginView"));
const RegisterView = lazy(() => import("@/views/RegisterView"));
const CharacterCreateView = lazy(() => import("@/views/CharacterCreateView"));
const DashboardView = lazy(() => import("@/views/DashboardView"));
const GigBoardView = lazy(() => import("@/views/GigBoardView"));
const SaideiraView = lazy(() => import("@/views/SaideiraView"));
const AdminPanel = lazy(() => import("@/views/admin/AdminPanel"));

function Lazy({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <span className="text-nd-text-secondary animate-pulse-neon font-data">▌ loading...</span>
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

const router = createBrowserRouter([
  {
    element: <App />,
    children: [
      { index: true, element: <Lazy><HomeView /></Lazy> },
      {
        element: <GuestOnly />,
        children: [
          { path: "login", element: <Lazy><LoginView /></Lazy> },
          { path: "register", element: <Lazy><RegisterView /></Lazy> },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          {
            element: <RequireCharacterless />,
            children: [
              { path: "create-character", element: <Lazy><CharacterCreateView /></Lazy> },
            ],
          },
          {
            element: <RequireCharacter />,
            children: [
              { path: "dashboard", element: <Lazy><DashboardView /></Lazy> },
              { path: "gigs",      element: <Lazy><GigBoardView /></Lazy> },
              { path: "saideira",  element: <Lazy><SaideiraView /></Lazy> },
            ],
          },
          {
            path: "admin",
            element: (
              <Lazy>
                <RequireAdmin>
                  <AdminPanel />
                </RequireAdmin>
              </Lazy>
            ),
          },
        ],
      },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
