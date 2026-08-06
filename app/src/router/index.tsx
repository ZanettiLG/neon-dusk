import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { lazy, Suspense, type ReactNode } from "react";
import App from "@/App";
import { RequireAuth } from "@/components/guards/RequireAuth";
import { RequireCharacter } from "@/components/guards/RequireCharacter";
import { RequireCharacterless } from "@/components/guards/RequireCharacterless";
import { GuestOnly } from "@/components/guards/GuestOnly";

const HomeView = lazy(() => import("@/views/HomeView"));
const LoginView = lazy(() => import("@/views/LoginView"));
const RegisterView = lazy(() => import("@/views/RegisterView"));
const CharacterCreateView = lazy(() => import("@/views/CharacterCreateView"));
const DashboardView = lazy(() => import("@/views/DashboardView"));

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
            ],
          },
        ],
      },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
