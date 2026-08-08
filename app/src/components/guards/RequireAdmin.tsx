import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth";

/**
 * Route guard: redirects non-admin users to /dashboard.
 * Must be nested inside <RequireAuth>.
 */
export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (!user || user.role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}
