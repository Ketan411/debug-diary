import { useEffect, useState, useCallback, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Building2,
  Check,
  Crown,
  Edit2,
  Plus,
  RefreshCw,
  Trash2,
  UserPlus,
  Users,
  Shield,
  Layers,
  CheckCircle2,
  Radio,
  Copy,
  Send,
  ExternalLink,
  GitCommit,
  GitPullRequest,
  Clock,
  Terminal,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  workspacesApi,
  webhooksApi,
  Workspace,
  WorkspaceDetail,
  WebhookConfig,
  WebhookEventItem,
} from "@/lib/api";

export const Route = createFileRoute("/settings")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: typeof search.tab === "string" ? search.tab : "workspaces",
  }),
  head: () => ({
    meta: [
      { title: "Workspace & Webhook Settings — DebugDiary" },
      {
        name: "description",
        content: "Manage workspaces, team members, and GitHub webhook integrations in your DebugDiary account.",
      },
      { property: "og:title", content: "Workspace & Webhook Settings — DebugDiary" },
      {
        property: "og:description",
        content: "Manage workspaces, team members, and GitHub webhook integrations in your DebugDiary account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const search = Route.useSearch();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentDetail, setCurrentDetail] = useState<WorkspaceDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Tab state
  const [activeTab, setActiveTab] = useState<string>(search.tab || "workspaces");

  // Webhook state
  const [webhookConfig, setWebhookConfig] = useState<WebhookConfig | null>(null);
  const [webhookEvents, setWebhookEvents] = useState<WebhookEventItem[]>([]);
  const [loadingWebhooks, setLoadingWebhooks] = useState(false);
  const [sendingPing, setSendingPing] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // New workspace state
  const [newWsName, setNewWsName] = useState("");
  const [creatingWs, setCreatingWs] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [dialogWsName, setDialogWsName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Rename state
  const [editName, setEditName] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [updatingName, setUpdatingName] = useState(false);

  // Invite member state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"ADMIN" | "MEMBER" | "VIEWER">("MEMBER");
  const [inviting, setInviting] = useState(false);

  // 1. Load Workspaces
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await workspacesApi.list();
      setWorkspaces(res.workspaces);

      const active = res.workspaces.find((w) => w.isCurrent) || res.workspaces[0];
      if (active) {
        const detailRes = await workspacesApi.get(active.id);
        setCurrentDetail(detailRes.workspace);
        setEditName(detailRes.workspace.name);
      }
    } catch (err) {
      toast.error("Failed to load workspaces", { description: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }, []);

  // 2. Load Webhooks
  const loadWebhooks = useCallback(async () => {
    setLoadingWebhooks(true);
    try {
      const [cfg, evs] = await Promise.all([
        webhooksApi.getConfig(),
        webhooksApi.getRecentEvents(),
      ]);
      setWebhookConfig(cfg);
      setWebhookEvents(evs.events || []);
    } catch (err) {
      console.error("Failed to load webhooks:", err);
    } finally {
      setLoadingWebhooks(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    loadWebhooks();
  }, [loadData, loadWebhooks]);

  const handleRefreshAll = () => {
    loadData();
    loadWebhooks();
    toast.info("Settings refreshed");
  };

  // Copy Webhook URL
  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    toast.success("Webhook URL copied to clipboard!", {
      description: "Paste this into your GitHub repository settings under Webhooks.",
    });
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  // Send Test Ping
  const handleSendTestPing = async () => {
    setSendingPing(true);
    try {
      const activeRepoName = currentDetail?.name ? `DebugDiary/${currentDetail.name}` : "DebugDiary/demo-repo";
      await webhooksApi.sendTestPing({ repository: activeRepoName });
      toast.success("Test ping received by webhook listener!", {
        description: "Pong response verified and recorded in recent deliveries.",
      });
      await loadWebhooks();
    } catch (err) {
      toast.error("Failed to send test ping", {
        description: (err as Error).message,
      });
    } finally {
      setSendingPing(false);
    }
  };

  // Create Workspace (Inline Form)
  const handleCreateWorkspace = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newWsName.trim();
    if (!trimmed) {
      toast.info("Please enter a workspace name first", {
        description: "Type your team or project name into the input field.",
      });
      inputRef.current?.focus();
      return;
    }

    if (trimmed.length < 2) {
      toast.error("Name too short", {
        description: "Workspace name must be at least 2 characters.",
      });
      inputRef.current?.focus();
      return;
    }

    setCreatingWs(true);
    try {
      const res = await workspacesApi.create(trimmed);
      toast.success("Workspace created successfully!", {
        description: `Switched to "${res.workspace.name}".`,
      });
      setNewWsName("");
      await loadData();
    } catch (err) {
      toast.error("Creation failed", { description: (err as Error).message });
    } finally {
      setCreatingWs(false);
    }
  };

  // Create Workspace (Dialog Modal)
  const handleCreateFromDialog = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = dialogWsName.trim();
    if (!trimmed) {
      toast.info("Please enter a workspace name first");
      return;
    }

    if (trimmed.length < 2) {
      toast.error("Name too short", {
        description: "Workspace name must be at least 2 characters.",
      });
      return;
    }

    setCreatingWs(true);
    try {
      const res = await workspacesApi.create(trimmed);
      toast.success("Workspace created successfully!", {
        description: `Switched to "${res.workspace.name}".`,
      });
      setDialogWsName("");
      setIsCreateDialogOpen(false);
      await loadData();
    } catch (err) {
      toast.error("Creation failed", { description: (err as Error).message });
    } finally {
      setCreatingWs(false);
    }
  };

  // Switch Workspace
  const handleSwitchWorkspace = async (id: string) => {
    try {
      const res = await workspacesApi.switch(id);
      toast.success("Active workspace switched", {
        description: `Now working in "${res.workspace.name}".`,
      });
      await loadData();
    } catch (err) {
      toast.error("Failed to switch workspace", { description: (err as Error).message });
    }
  };

  // Rename Workspace
  const handleRenameWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentDetail || !editName.trim()) return;

    setUpdatingName(true);
    try {
      await workspacesApi.update(currentDetail.id, editName.trim());
      toast.success("Workspace updated", {
        description: `Renamed to "${editName.trim()}".`,
      });
      setIsEditingName(false);
      await loadData();
    } catch (err) {
      toast.error("Rename failed", { description: (err as Error).message });
    } finally {
      setUpdatingName(false);
    }
  };

  // Invite Member
  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentDetail || !inviteEmail.trim()) return;

    setInviting(true);
    try {
      await workspacesApi.addMember(currentDetail.id, inviteEmail.trim(), inviteRole);
      toast.success("Member added", {
        description: `${inviteEmail.trim()} was added to the workspace.`,
      });
      setInviteEmail("");
      await loadData();
    } catch (err) {
      toast.error("Invitation failed", { description: (err as Error).message });
    } finally {
      setInviting(false);
    }
  };

  // Remove Member
  const handleRemoveMember = async (userId: string) => {
    if (!currentDetail) return;
    try {
      await workspacesApi.removeMember(currentDetail.id, userId);
      toast.success("Member removed from workspace");
      await loadData();
    } catch (err) {
      toast.error("Removal failed", { description: (err as Error).message });
    }
  };

  // Delete Workspace
  const handleDeleteWorkspace = async () => {
    if (!currentDetail) return;
    if (!window.confirm(`Are you sure you want to delete "${currentDetail.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await workspacesApi.delete(currentDetail.id);
      toast.success("Workspace deleted", {
        description: "Switched to your remaining workspace.",
      });
      await loadData();
    } catch (err) {
      toast.error("Delete failed", { description: (err as Error).message });
    }
  };

  const webhookUrl = webhookConfig?.webhookUrl || "http://localhost:5000/api/webhooks/github";

  return (
    <AppShell title="Settings">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Workspaces & Settings
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Manage workspaces, team access, and real-time GitHub webhook sync.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshAll}
            disabled={loading || loadingWebhooks}
            className="gap-2"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading || loadingWebhooks ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Navigation Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-md bg-muted/60 border border-border">
            <TabsTrigger value="workspaces" className="gap-2 text-xs sm:text-sm">
              <Building2 className="h-4 w-4 text-primary" />
              Workspaces & Team
            </TabsTrigger>
            <TabsTrigger value="webhooks" className="gap-2 text-xs sm:text-sm">
              <Radio className="h-4 w-4 text-emerald-500 animate-pulse" />
              GitHub Webhooks
              <Badge
                variant="secondary"
                className="ml-1 text-[10px] py-0 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
              >
                Live
              </Badge>
            </TabsTrigger>
          </TabsList>

          {/* ═══════════════════════════════════════════════════════════════════
              TAB 1: WORKSPACES & TEAM
          ════════════════════════════════════════════════════════════════════ */}
          <TabsContent value="workspaces" className="space-y-6 outline-none">
            {/* All Workspaces Section */}
            <Card className="border-border/70 bg-card/60 backdrop-blur-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base">Your Workspaces</CardTitle>
                    <Badge variant="secondary" className="font-mono text-xs ml-1">
                      {workspaces.length} {workspaces.length === 1 ? "Workspace" : "Workspaces"}
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setIsCreateDialogOpen(true)}
                    className="gap-1.5 h-8 text-xs bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    New Workspace
                  </Button>
                </div>
                <CardDescription>
                  Each workspace has its own isolated GitHub repositories, incidents, and review queues.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  {workspaces.map((ws) => (
                    <div
                      key={ws.id}
                      className={`flex flex-col justify-between rounded-lg border p-4 transition-all ${
                        ws.isCurrent
                          ? "border-primary/50 bg-primary/5 shadow-sm ring-1 ring-primary/20"
                          : "border-border bg-background/50 hover:border-border/80"
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{ws.name}</span>
                            {ws.isCurrent && (
                              <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px] py-0">
                                Active
                              </Badge>
                            )}
                          </div>
                          <Badge variant="outline" className="text-[10px]">
                            {ws.role === "OWNER" && <Crown className="mr-1 h-3 w-3 text-amber-500" />}
                            {ws.role}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>{ws.memberCount ?? 1} members</span>
                          <span>•</span>
                          <span>{ws.repositoryCount ?? 0} repos</span>
                          <span>•</span>
                          <span>{ws.incidentCount ?? 0} incidents</span>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-border/50 flex justify-end">
                        {ws.isCurrent ? (
                          <span className="flex items-center gap-1.5 text-xs font-medium text-primary">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Currently Active
                          </span>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs gap-1.5"
                            onClick={() => handleSwitchWorkspace(ws.id)}
                          >
                            <Layers className="h-3.5 w-3.5" />
                            Switch to this
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Create New Workspace Inline Form */}
                <form
                  onSubmit={handleCreateWorkspace}
                  className="mt-4 flex flex-col sm:flex-row gap-2 pt-3 border-t border-border/50"
                >
                  <div className="flex-1">
                    <Input
                      ref={inputRef}
                      type="text"
                      placeholder="New workspace name (e.g. Mobile Team, Payments Squad)"
                      value={newWsName}
                      onChange={(e) => setNewWsName(e.target.value)}
                      className="h-9 text-sm bg-background/50 focus-visible:ring-primary"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={creatingWs}
                    className="h-9 gap-1.5 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer font-medium"
                  >
                    <Plus className="h-4 w-4" />
                    {creatingWs ? "Creating..." : "Create Workspace"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Active Workspace Details & Members */}
            {currentDetail && (
              <Card className="border-border/70 bg-card/60 backdrop-blur-sm">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-primary" />
                      <CardTitle className="text-base">Active Workspace: {currentDetail.name}</CardTitle>
                    </div>
                    <Badge variant="outline" className="font-mono text-xs">
                      Role: {currentDetail.role}
                    </Badge>
                  </div>
                  <CardDescription>
                    Configure settings and team access for the currently active workspace.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Rename Form */}
                  <div className="space-y-2">
                    <Label htmlFor="wsName">Workspace Name</Label>
                    {isEditingName ? (
                      <form onSubmit={handleRenameWorkspace} className="flex gap-2 max-w-md">
                        <Input
                          id="wsName"
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-9 text-sm"
                          required
                        />
                        <Button type="submit" size="sm" disabled={updatingName} className="h-9 gap-1">
                          <Check className="h-3.5 w-3.5" />
                          Save
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditName(currentDetail.name);
                            setIsEditingName(false);
                          }}
                          className="h-9"
                        >
                          Cancel
                        </Button>
                      </form>
                    ) : (
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-foreground">{currentDetail.name}</span>
                        {(currentDetail.role === "OWNER" || currentDetail.role === "ADMIN") && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-muted-foreground gap-1 hover:text-foreground"
                            onClick={() => setIsEditingName(true)}
                          >
                            <Edit2 className="h-3 w-3" />
                            Rename
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Members Section */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground">Workspace Members</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {currentDetail.members.length} {currentDetail.members.length === 1 ? "member" : "members"}
                      </span>
                    </div>

                    <div className="rounded-md border border-border divide-y divide-border">
                      {currentDetail.members.map((member) => (
                        <div
                          key={member.userId}
                          className="flex items-center justify-between p-3 text-sm"
                        >
                          <div>
                            <p className="font-medium text-foreground">{member.name}</p>
                            <p className="text-xs text-muted-foreground">{member.email}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {member.role === "OWNER" && <Crown className="mr-1 h-3 w-3 text-amber-500" />}
                              {member.role}
                            </Badge>
                            {member.role !== "OWNER" &&
                              (currentDetail.role === "OWNER" || currentDetail.role === "ADMIN") && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  title="Remove member"
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                  onClick={() => handleRemoveMember(member.userId)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Add Member Form */}
                    {(currentDetail.role === "OWNER" || currentDetail.role === "ADMIN") && (
                      <form onSubmit={handleInviteMember} className="flex flex-col sm:flex-row gap-2 pt-2">
                        <div className="flex-1">
                          <Input
                            type="email"
                            placeholder="Teammate's email address"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            className="h-9 text-sm"
                            required
                          />
                        </div>
                        <select
                          value={inviteRole}
                          onChange={(e) => setInviteRole(e.target.value as "ADMIN" | "MEMBER" | "VIEWER")}
                          className="h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                          <option value="MEMBER">Member</option>
                          <option value="ADMIN">Admin</option>
                          <option value="VIEWER">Viewer</option>
                        </select>
                        <Button
                          type="submit"
                          variant="outline"
                          disabled={inviting || !inviteEmail.trim()}
                          className="h-9 gap-1.5 shrink-0"
                        >
                          <UserPlus className="h-4 w-4" />
                          {inviting ? "Adding..." : "Add Member"}
                        </Button>
                      </form>
                    )}
                  </div>

                  {/* Danger Zone: Delete Workspace */}
                  {currentDetail.role === "OWNER" && workspaces.length > 1 && (
                    <>
                      <Separator />
                      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-3">
                        <div>
                          <h4 className="text-sm font-semibold text-destructive">Danger Zone</h4>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Permanently delete &quot;{currentDetail.name}&quot; and all connected repositories and incidents.
                          </p>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={handleDeleteWorkspace}
                          className="gap-1.5 text-xs h-8"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete This Workspace
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ═══════════════════════════════════════════════════════════════════
              TAB 2: GITHUB WEBHOOKS & REAL-TIME SYNC
          ════════════════════════════════════════════════════════════════════ */}
          <TabsContent value="webhooks" className="space-y-6 outline-none">
            {/* Webhook Status & Payload Card */}
            <Card className="border-border/70 bg-card/60 backdrop-blur-sm">
              <CardHeader>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <Radio className="h-5 w-5 text-emerald-500" />
                    <CardTitle className="text-base">GitHub Webhook Listener</CardTitle>
                    <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-xs gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      Active & Listening
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSendTestPing}
                      disabled={sendingPing}
                      className="h-8 gap-1.5 text-xs"
                    >
                      <Send className={`h-3.5 w-3.5 ${sendingPing ? "animate-spin" : ""}`} />
                      {sendingPing ? "Sending..." : "Send Test Ping"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={loadWebhooks}
                      disabled={loadingWebhooks}
                      className="h-8 gap-1.5 text-xs"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${loadingWebhooks ? "animate-spin" : ""}`} />
                      Refresh
                    </Button>
                  </div>
                </div>
                <CardDescription>
                  DebugDiary automatically receives push and pull request events from GitHub to index bug fixes, track commits, and keep your debugging knowledge base synchronized in real-time.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Payload URL Box */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Webhook Payload URL
                  </Label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 rounded-md border border-border bg-muted/40 px-3 py-2 font-mono text-xs sm:text-sm text-foreground select-all break-all">
                      {webhookUrl}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyUrl(webhookUrl)}
                      className="h-10 gap-1.5 text-xs shrink-0"
                    >
                      {copiedUrl ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      {copiedUrl ? "Copied!" : "Copy URL"}
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Tip: When testing from public GitHub to a local machine, forward port 5000 using <code className="text-primary font-mono">ngrok http 5000</code> or your public domain.
                  </p>
                </div>

                {/* Configuration Specs Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className="rounded-lg border border-border/80 bg-background/50 p-3">
                    <p className="text-xs text-muted-foreground font-medium">Content Type</p>
                    <p className="mt-1 font-mono text-xs text-foreground font-semibold">
                      application/json
                    </p>
                  </div>
                  <div className="rounded-lg border border-border/80 bg-background/50 p-3">
                    <p className="text-xs text-muted-foreground font-medium">Secret Key (HMAC)</p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      <p className="font-mono text-xs text-foreground font-semibold">
                        {webhookConfig?.secretConfigured ? "Configured (SHA-256)" : "Active (Verification Ready)"}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-lg border border-border/80 bg-background/50 p-3">
                    <p className="text-xs text-muted-foreground font-medium">Subscribed Events</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {["push", "pull_request", "ping"].map((ev) => (
                        <Badge key={ev} variant="secondary" className="font-mono text-[10px] py-0">
                          {ev}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* How to setup guide */}
            <Card className="border-border/70 bg-card/60 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm font-semibold">Setup Instructions in GitHub</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-3 text-xs">
                  <div className="rounded-md border border-border/60 bg-background/40 p-3 space-y-1">
                    <span className="font-semibold text-primary">1. Navigate to Settings</span>
                    <p className="text-muted-foreground">
                      In your GitHub repository, open <strong>Settings</strong> → <strong>Webhooks</strong> → click <strong>Add webhook</strong>.
                    </p>
                  </div>
                  <div className="rounded-md border border-border/60 bg-background/40 p-3 space-y-1">
                    <span className="font-semibold text-primary">2. Set Payload URL</span>
                    <p className="text-muted-foreground">
                      Paste the URL above, set Content type to <strong>application/json</strong>, and enter your secret if configured.
                    </p>
                  </div>
                  <div className="rounded-md border border-border/60 bg-background/40 p-3 space-y-1">
                    <span className="font-semibold text-primary">3. Select Events & Save</span>
                    <p className="text-muted-foreground">
                      Select <strong>Just the push event</strong> (or select Pull requests) and click <strong>Add webhook</strong>.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Webhook Deliveries Table */}
            <Card className="border-border/70 bg-card/60 backdrop-blur-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Terminal className="h-4 w-4 text-primary" />
                    <CardTitle className="text-base">Recent Webhook Deliveries</CardTitle>
                    <Badge variant="outline" className="font-mono text-xs ml-1">
                      {webhookEvents.length} {webhookEvents.length === 1 ? "Event" : "Events"}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={loadWebhooks}
                    disabled={loadingWebhooks}
                    className="h-8 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                  >
                    <RefreshCw className={`h-3 w-3 ${loadingWebhooks ? "animate-spin" : ""}`} />
                    Refresh
                  </Button>
                </div>
                <CardDescription>
                  Incoming webhook deliveries received by the backend listener with event types and processing status.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {webhookEvents.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-8 text-center">
                    <Radio className="mx-auto h-8 w-8 text-muted-foreground/60" />
                    <h4 className="mt-3 text-sm font-medium text-foreground">No webhook deliveries recorded yet</h4>
                    <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
                      Click the &quot;Send Test Ping&quot; button above to simulate a GitHub ping delivery and test the pipeline.
                    </p>
                    <div className="mt-4">
                      <Button size="sm" onClick={handleSendTestPing} disabled={sendingPing} className="gap-1.5 text-xs">
                        <Send className="h-3 w-3" />
                        Send Test Ping
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border">
                        <tr>
                          <th className="px-3 py-2.5 font-medium">Delivery ID</th>
                          <th className="px-3 py-2.5 font-medium">Event</th>
                          <th className="px-3 py-2.5 font-medium">Repository</th>
                          <th className="px-3 py-2.5 font-medium">Sender</th>
                          <th className="px-3 py-2.5 font-medium">Changes</th>
                          <th className="px-3 py-2.5 font-medium">Status</th>
                          <th className="px-3 py-2.5 font-medium">Received</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border font-mono">
                        {webhookEvents.map((event) => (
                          <tr key={event.id} className="hover:bg-muted/30 transition-colors">
                            <td className="px-3 py-2 text-foreground font-medium truncate max-w-[140px]" title={event.deliveryId}>
                              {event.deliveryId}
                            </td>
                            <td className="px-3 py-2">
                              {event.eventType === "push" && (
                                <Badge className="bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/20 text-[10px] gap-1 py-0 font-sans">
                                  <GitCommit className="h-3 w-3" />
                                  push
                                </Badge>
                              )}
                              {event.eventType === "ping" && (
                                <Badge className="bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/20 text-[10px] gap-1 py-0 font-sans">
                                  <Radio className="h-3 w-3" />
                                  ping
                                </Badge>
                              )}
                              {event.eventType === "pull_request" && (
                                <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] gap-1 py-0 font-sans">
                                  <GitPullRequest className="h-3 w-3" />
                                  pull_request
                                </Badge>
                              )}
                              {event.eventType !== "push" && event.eventType !== "ping" && event.eventType !== "pull_request" && (
                                <Badge variant="outline" className="text-[10px] py-0 font-sans">
                                  {event.eventType}
                                </Badge>
                              )}
                            </td>
                            <td className="px-3 py-2 text-foreground font-sans truncate max-w-[160px]" title={event.repository}>
                              {event.repository}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground font-sans">
                              {event.sender ? `@${event.sender}` : "-"}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground font-sans">
                              {event.commitsCount !== null ? (
                                <span className="font-semibold text-foreground">+{event.commitsCount} commits</span>
                              ) : (
                                "-"
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-sans text-[11px] font-medium">
                                <CheckCircle2 className="h-3 w-3" />
                                Processed
                              </span>
                            </td>
                            <td className="px-3 py-2 text-muted-foreground font-sans text-[11px] whitespace-nowrap">
                              {new Date(event.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Create Workspace Modal Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Workspace</DialogTitle>
              <DialogDescription>
                Create a dedicated workspace for your team or microservice.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateFromDialog} className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="dialog-ws-name">Workspace Name</Label>
                <Input
                  id="dialog-ws-name"
                  type="text"
                  placeholder="e.g. Payments Squad, Core Infra"
                  value={dialogWsName}
                  onChange={(e) => setDialogWsName(e.target.value)}
                  className="h-9 text-sm"
                  autoFocus
                  required
                />
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={creatingWs}
                  className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Plus className="h-4 w-4" />
                  {creatingWs ? "Creating..." : "Create Workspace"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
