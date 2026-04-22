import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, FileText, Users, Receipt, BookOpen, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/dc", label: "DC Register", icon: FileText },
  { to: "/app/register", label: "Daily Register", icon: BookOpen },
  { to: "/app/bills", label: "Bills", icon: Receipt },
  { to: "/app/customers", label: "Customers", icon: Users },
  { to: "/app/reports", label: "Reports", icon: BarChart3 },
] as const;

export function Sidebar() {
  const { location } = useRouterState();
  const path = location.pathname;
  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="px-5 py-5 border-b">
        <Link to="/" className="block">
          <div className="text-lg font-semibold">Murgi Hisaab</div>
          <div className="text-xs text-muted-foreground">Wholesaler Manager</div>
        </Link>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {nav.map((item) => {
          const active = item.to === "/app" ? path === "/app" : path.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 text-xs text-muted-foreground border-t">
        Offline-first · Local DB
      </div>
    </aside>
  );
}

export function MobileNav() {
  const { location } = useRouterState();
  const path = location.pathname;
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t bg-background flex justify-around py-2">
      {nav.map((item) => {
        const active = item.to === "/app" ? path === "/app" : path.startsWith(item.to);
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              "flex flex-col items-center gap-0.5 px-2 py-1 text-[10px]",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{item.label.split(" ")[0]}</span>
          </Link>
        );
      })}
    </nav>
  );
}