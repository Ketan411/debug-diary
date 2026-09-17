import { Link } from "@tanstack/react-router";
import {
  BarChart3,
  BookOpen,
  GitBranch,
  LayoutDashboard,
  Search,
  Settings,
  ShieldAlert,
} from "lucide-react";

import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/utils";

const navItems = [
  { title: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { title: "Knowledge", to: "/knowledge", icon: BookOpen },
  { title: "Incident Review", to: "/incident-review", icon: ShieldAlert },
  { title: "Search", to: "/search", icon: Search },
  { title: "Repositories", to: "/repositories", icon: GitBranch },
  { title: "Analytics", to: "/analytics", icon: BarChart3 },
] as const;

const linkClass =
  "flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground";

const activeClass = "bg-sidebar-accent text-foreground";

export function AppSidebar() {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-sidebar md:flex">
      <div className="flex h-14 items-center border-b border-border px-4">
        <Logo
          iconClassName="h-7 w-7 rounded-md"
          textClassName="text-sm font-semibold uppercase tracking-[0.14em]"
        />
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={linkClass}
            activeProps={{ className: cn(linkClass, activeClass) }}
          >
            <item.icon className="h-4 w-4" />
            {item.title}
          </Link>
        ))}
      </nav>

      <div className="border-t border-border p-3">
        <Link
          to="/settings"
          className={linkClass}
          activeProps={{ className: cn(linkClass, activeClass) }}
        >
          <Settings className="h-4 w-4" />
          Settings
        </Link>
      </div>
    </aside>
  );
}
