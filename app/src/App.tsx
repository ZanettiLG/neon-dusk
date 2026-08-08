import { Outlet } from "react-router-dom";
import AppHeader from "@/components/AppHeader";
import AppFooter from "@/components/AppFooter";
import InstallPrompt from "@/components/InstallPrompt";

/** App shell: header + routed content + install prompt + footer (port of App.vue). */
export default function App() {
  return (
    <div className="min-h-screen bg-nd-bg flex flex-col">
      <AppHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      <InstallPrompt />
      <AppFooter />
    </div>
  );
}
