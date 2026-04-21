import { Outlet } from "@tanstack/react-router";
import { Sidebar, MobileNav } from "./Sidebar";
import { Toaster } from "@/components/ui/sonner";

export function AppShell() {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 min-w-0 pb-20 md:pb-0">
        <Outlet />
      </main>
      <MobileNav />
      <Toaster richColors position="top-right" />
    </div>
  );
}