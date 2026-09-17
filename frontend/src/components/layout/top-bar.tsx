import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Building2,
  Check,
  ChevronsUpDown,
  LogOut,
  Plus,
  Search,
  Settings,
} from "lucide-react";
import { toast } from "sonner";

import { authApi, User, workspacesApi, Workspace } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface TopBarProps {
  title: string;
}

export function TopBar({ title }: TopBarProps) {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newWsName, setNewWsName] = useState("");
  const [creating, setCreating] = useState(false);

  const loadWorkspaces = useCallback(async () => {
    try {
      const res = await workspacesApi.list();
      setWorkspaces(res.workspaces);
    } catch {
      // ignore
    }
  }, []);

  const loadUser = useCallback(async () => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("debugdiary_user");
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        // ignore
      }
    }
    try {
      const me = await authApi.getMe();
      if (me) {
        setUser(me);
        localStorage.setItem("debugdiary_user", JSON.stringify(me));
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadUser();
    loadWorkspaces();
    window.addEventListener("auth_change", loadUser);
    return () => {
      window.removeEventListener("auth_change", loadUser);
    };
  }, [loadUser, loadWorkspaces]);

  const handleLogout = () => {
    authApi.logout();
    setUser(null);
    navigate({ to: "/" });
  };

  const handleSwitch = async (workspaceId: string) => {
    try {
      const res = await workspacesApi.switch(workspaceId);
      toast.success("Switched workspace", {
        description: `Now viewing ${res.workspace.name}`,
      });
      window.location.reload();
    } catch (err) {
      toast.error("Failed to switch workspace", {
        description: (err as Error).message,
      });
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsName.trim()) return;

    setCreating(true);
    try {
      const res = await workspacesApi.create(newWsName.trim());
      toast.success("Workspace created!", {
        description: `Switched to "${res.workspace.name}".`,
      });
      setIsCreateOpen(false);
      setNewWsName("");
      window.location.reload();
    } catch (err) {
      toast.error("Failed to create workspace", {
        description: (err as Error).message,
      });
    } finally {
      setCreating(false);
    }
  };

  const activeWorkspace = workspaces.find((w) => w.isCurrent) || workspaces[0];
  const displayName = user?.name || "User";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-background/80 px-4 backdrop-blur sm:px-6">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-foreground">{title}</span>

          {/* Workspace Selector Dropdown */}
          <div className="hidden sm:flex items-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-md border border-border/80 bg-card/60 px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <Building2 className="h-3.5 w-3.5 text-primary" />
                  <span className="max-w-[160px] truncate font-medium">
                    {activeWorkspace?.name || "Workspace"}
                  </span>
                  <ChevronsUpDown className="h-3 w-3 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel className="text-[11px] text-muted-foreground font-normal">
                  Workspaces ({workspaces.length})
                </DropdownMenuLabel>
                {workspaces.map((ws) => (
                  <DropdownMenuItem
                    key={ws.id}
                    onClick={() => handleSwitch(ws.id)}
                    className="flex items-center justify-between text-xs cursor-pointer"
                  >
                    <span className="truncate">{ws.name}</span>
                    {ws.isCurrent && <Check className="h-3.5 w-3.5 text-primary shrink-0 ml-2" />}
                  </DropdownMenuItem>
                ))}

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onClick={() => setIsCreateOpen(true)}
                  className="flex items-center gap-2 text-xs cursor-pointer text-primary"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create New Workspace
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => navigate({ to: "/settings" })}
                  className="flex items-center gap-2 text-xs cursor-pointer text-muted-foreground"
                >
                  <Settings className="h-3.5 w-3.5" />
                  Workspace Settings
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate({ to: "/search" })}
            className="flex items-center gap-2 rounded-md border border-border bg-card/60 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Search incidents</span>
            <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px]">
              ⌘K
            </kbd>
          </button>

          <div className="flex items-center gap-2 border-l border-border pl-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-[11px] font-medium text-primary">
              {initials}
            </div>
            <div className="hidden leading-tight sm:block">
              <p className="text-xs font-medium text-foreground">{displayName}</p>
              <p className="text-[11px] text-muted-foreground">Engineering</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              title="Sign out"
              className="ml-2 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Create Workspace Modal Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Workspace</DialogTitle>
            <DialogDescription>
              Create an isolated workspace to organize your repositories, team members, and debugging knowledge.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 py-2">
            <div className="space-y-2">
              <label htmlFor="ws-name-input" className="text-xs font-medium text-foreground">
                Workspace Name
              </label>
              <Input
                id="ws-name-input"
                type="text"
                placeholder="e.g. Mobile Team, Payments API"
                value={newWsName}
                onChange={(e) => setNewWsName(e.target.value)}
                className="h-9 text-sm"
                required
                autoFocus
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={creating || !newWsName.trim()}
                className="gap-1.5"
              >
                <Plus className="h-4 w-4" />
                {creating ? "Creating..." : "Create Workspace"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
