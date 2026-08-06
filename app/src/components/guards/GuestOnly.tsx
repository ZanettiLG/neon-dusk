import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/stores/auth";

/** Redirects authenticated users away from guest pages (design §3.2). */
export function GuestOnly() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const character = useAuthStore((s) => s.character);
  if (accessToken) {
    return <Navigate to={character ? "/dashboard" : "/create-character"} replace />;
  }
  return <Outlet />;
}
