import { Outlet } from "react-router-dom";
import AppHeader from "@/components/AppHeader";
import AppFooter from "@/components/AppFooter";

/** App shell: header + routed content + footer (port of App.vue). */
export default function App() {
  return (
    <div className="min-h-screen bg-nd-bg flex flex-col">
      <AppHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      <AppFooter />
    </div>
  );
}
