import { useEffect, useState, useCallback, useMemo } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Plus,
  RefreshCw,
  Github,
  ExternalLink,
  Lock,
  Globe,
  Star,
  CheckCircle2,
  Search,
  ArrowRight,
  Sparkles,
  GitBranch,
  Radio,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RepositoryCard } from "@/components/repositories/repository-card";
import { ConnectRepositoryDialog } from "@/components/repositories/connect-repository-dialog";
import { repositoriesApi, authApi, Repository, AvailableGitHubRepo } from "@/lib/api";

export const Route = createFileRoute("/repositories")({
  head: () => ({
    meta: [
      { title: "Repositories — DebugDiary" },
      {
        name: "description",
        content:
          "Connect and manage the GitHub repositories used to build your DebugDiary debugging knowledge base.",
      },
      { property: "og:title", content: "Repositories — DebugDiary" },
      {
        property: "og:description",
        content:
          "Connect and manage the GitHub repositories used to build your DebugDiary debugging knowledge base.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RepositoriesPage,
});

function RepositoriesPage() {
  const navigate = useNavigate();
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [availableRepos, setAvailableRepos] = useState<AvailableGitHubRepo[]>([]);
  const [githubConnected, setGithubConnected] = useState<boolean>(false);
  const [githubUsername, setGithubUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingAvailable, setLoadingAvailable] = useState(true);
  const [connectingId, setConnectingId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<string>("connected");

  // 1. Load Connected Repositories
  const loadConnectedRepositories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await repositoriesApi.list();
      setRepositories(res.repositories);
    } catch (err) {
      console.error("Failed to load connected repositories:", err);
      toast.error("Failed to load connected repositories", {
        description: (err as Error).message,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // 2. Load Available GitHub Repositories
  const loadAvailableRepositories = useCallback(async () => {
    setLoadingAvailable(true);
    try {
      const res = await repositoriesApi.listAvailableGitHub();
      setGithubConnected(res.connected);
      if (res.githubUsername) setGithubUsername(res.githubUsername);
      setAvailableRepos(res.repositories || []);
    } catch (err) {
      console.error("Failed to load available GitHub repositories:", err);
    } finally {
      setLoadingAvailable(false);
    }
  }, []);

  const loadAll = useCallback(() => {
    loadConnectedRepositories();
    loadAvailableRepositories();
  }, [loadConnectedRepositories, loadAvailableRepositories]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Connect a repository with 1-click
  const handleConnect = async (repo: AvailableGitHubRepo) => {
    setConnectingId(repo.id);
    try {
      const res = await repositoriesApi.connect({
        url: repo.htmlUrl,
        description: repo.description || undefined,
      });
      toast.success(`Connected ${repo.fullName}!`, {
        description: "Initial synchronization has been queued.",
      });

      // Trigger sync
      if (res.repository?.id) {
        repositoriesApi.sync(res.repository.id).catch(console.error);
      }

      await loadAll();
    } catch (err) {
      toast.error("Failed to connect repository", {
        description: (err as Error).message,
      });
    } finally {
      setConnectingId(null);
    }
  };

  // Filter available GitHub repos by search
  const filteredAvailable = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return availableRepos;
    return availableRepos.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.fullName.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        (r.language && r.language.toLowerCase().includes(q))
    );
  }, [availableRepos, searchQuery]);

  const unconnectedCount = useMemo(() => {
    return availableRepos.filter((r) => !r.isConnected).length;
  }, [availableRepos]);

  return (
    <AppShell title="Repositories">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Repositories</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Connect and manage the GitHub repositories used to build your debugging knowledge base.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate({ to: "/settings", search: { tab: "webhooks" } })}
              title="View GitHub Webhook Listener & Deliveries"
              className="gap-1.5 text-xs"
            >
              <Radio className="h-3.5 w-3.5 text-emerald-500 animate-pulse" />
              Webhook Sync
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={loadAll}
              disabled={loading || loadingAvailable}
              title="Refresh repositories"
              className="gap-2"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading || loadingAvailable ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
            <ConnectRepositoryDialog onConnected={loadAll}>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Connect Custom URL
              </Button>
            </ConnectRepositoryDialog>
          </div>
        </div>

        {/* Tab Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full max-w-md grid-cols-2 bg-muted/60 p-1">
            <TabsTrigger value="connected" className="gap-2 text-xs">
              <span>Connected Repositories</span>
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                {repositories.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="github" className="gap-2 text-xs">
              <Github className="h-3.5 w-3.5" />
              <span>Available on GitHub</span>
              {availableRepos.length > 0 && (
                <Badge
                  variant={unconnectedCount > 0 ? "default" : "secondary"}
                  className="px-1.5 py-0 text-[10px]"
                >
                  {availableRepos.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Connected Repositories */}
          <TabsContent value="connected" className="space-y-4 outline-none">
            {/* Real-time Webhook Active Status Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-lg border border-border/80 bg-card/60 p-3 text-xs text-foreground backdrop-blur-sm gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span className="text-muted-foreground">
                  Real-time webhook listener is <strong className="text-foreground">Active</strong> at <code className="text-primary font-mono font-medium">/api/webhooks/github</code>. Push events sync automatically.
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate({ to: "/settings", search: { tab: "webhooks" } })}
                className="h-7 px-2 text-xs text-primary hover:text-primary gap-1 shrink-0 cursor-pointer"
              >
                View Webhook Deliveries
                <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
            {/* Notification Banner when user has unconnected GitHub repos */}
            {githubConnected && unconnectedCount > 0 && (
              <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm text-foreground">
                <div className="flex items-center gap-3">
                  <Sparkles className="h-5 w-5 text-primary shrink-0" />
                  <div>
                    <span className="font-medium">
                      You have {unconnectedCount} available GitHub{" "}
                      {unconnectedCount === 1 ? "repository" : "repositories"}
                    </span>{" "}
                    from your account ({githubUsername ? `@${githubUsername}` : "GitHub"}) ready to
                    connect.
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActiveTab("github")}
                  className="gap-1.5 text-xs shrink-0 ml-4 border-primary/40 text-primary hover:bg-primary/10"
                >
                  Browse Repositories
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            <div className="grid gap-4">
              {repositories.length === 0 && !loading && (
                <div className="rounded-lg border border-dashed border-border p-12 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <Github className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <h3 className="mt-4 text-base font-medium text-foreground">
                    No repositories connected yet
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
                    Connect your GitHub repositories to allow DebugDiary to analyze your commit
                    history and index your debugging knowledge base.
                  </p>
                  <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                    {githubConnected ? (
                      <Button onClick={() => setActiveTab("github")} className="gap-2">
                        <Github className="h-4 w-4" />
                        Browse Your GitHub Repositories ({availableRepos.length})
                      </Button>
                    ) : (
                      <Button
                        onClick={() => {
                          window.location.href = `${authApi.getGithubAuthUrl()}?returnTo=/repositories`;
                        }}
                        className="gap-2"
                      >
                        <Github className="h-4 w-4" />
                        Connect GitHub Account
                      </Button>
                    )}
                    <ConnectRepositoryDialog onConnected={loadAll}>
                      <Button variant="outline" className="gap-2">
                        <Plus className="h-4 w-4" />
                        Enter Repository URL Manually
                      </Button>
                    </ConnectRepositoryDialog>
                  </div>
                </div>
              )}

              {repositories.map((repository) => (
                <RepositoryCard
                  key={repository.id || repository.name}
                  id={repository.id}
                  name={repository.name}
                  description={repository.description}
                  status={repository.status}
                  lastSynced={repository.lastSynced}
                  commitsAnalyzed={repository.commitsAnalyzed}
                  bugFixesDetected={repository.bugFixesDetected}
                  githubUrl={repository.githubUrl}
                  onSyncComplete={loadAll}
                />
              ))}
            </div>
          </TabsContent>

          {/* TAB 2: Available on GitHub */}
          <TabsContent value="github" className="space-y-4 outline-none">
            {!githubConnected ? (
              <div className="rounded-lg border border-border bg-card/60 p-8 text-center backdrop-blur-sm">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Github className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-foreground">
                  Connect Your GitHub Account
                </h3>
                <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
                  Authorize DebugDiary with GitHub to automatically browse and connect your personal
                  and organization repositories with 1 click.
                </p>
                <div className="mt-6">
                  <Button
                    onClick={() => {
                      window.location.href = `${authApi.getGithubAuthUrl()}?returnTo=/repositories`;
                    }}
                    className="gap-2"
                  >
                    <Github className="h-4 w-4" />
                    Sign in & Connect with GitHub
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Account & Search Bar */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-border/70 bg-card/60 p-4 backdrop-blur-sm">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                      <Github className="h-4 w-4 text-foreground" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-foreground">
                        {githubUsername ? `@${githubUsername}` : "GitHub Account"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {availableRepos.length} accessible repositories ({unconnectedCount} available to
                        connect)
                      </div>
                    </div>
                  </div>

                  <div className="relative w-full sm:w-72">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Search your repos..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 h-9 text-xs bg-background/50"
                    />
                  </div>
                </div>

                {/* Repositories Grid */}
                {loadingAvailable ? (
                  <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Loading your GitHub repositories...</span>
                  </div>
                ) : filteredAvailable.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                    {searchQuery
                      ? `No repositories match "${searchQuery}".`
                      : "No repositories found on this GitHub account."}
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredAvailable.map((repo) => (
                      <Card
                        key={repo.id}
                        className={`flex flex-col justify-between border transition-all ${
                          repo.isConnected
                            ? "border-emerald-500/30 bg-emerald-500/5"
                            : "border-border/70 bg-card/60 hover:border-border"
                        }`}
                      >
                        <CardContent className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                          <div className="space-y-2">
                            {/* Title & Badges */}
                            <div className="flex items-start justify-between gap-2">
                              <a
                                href={repo.htmlUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="font-semibold text-sm text-foreground hover:text-primary hover:underline flex items-center gap-1.5 truncate"
                                title={repo.fullName}
                              >
                                <span className="truncate">{repo.name}</span>
                                <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                              </a>
                              <Badge
                                variant="outline"
                                className="text-[10px] shrink-0 font-normal gap-1"
                              >
                                {repo.isPrivate ? (
                                  <>
                                    <Lock className="h-2.5 w-2.5 text-amber-500" />
                                    Private
                                  </>
                                ) : (
                                  <>
                                    <Globe className="h-2.5 w-2.5 text-muted-foreground" />
                                    Public
                                  </>
                                )}
                              </Badge>
                            </div>

                            {/* Description */}
                            <p className="text-xs text-muted-foreground line-clamp-2 min-h-[32px]">
                              {repo.description || "No description provided."}
                            </p>

                            {/* Meta: Language, Stars, Branch */}
                            <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-1">
                              {repo.language && (
                                <span className="flex items-center gap-1">
                                  <span className="h-2 w-2 rounded-full bg-primary/70 inline-block" />
                                  {repo.language}
                                </span>
                              )}
                              {repo.stars > 0 && (
                                <span className="flex items-center gap-0.5">
                                  <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                                  {repo.stars}
                                </span>
                              )}
                              <span className="flex items-center gap-1 truncate max-w-[120px]">
                                <GitBranch className="h-3 w-3" />
                                {repo.defaultBranch}
                              </span>
                            </div>
                          </div>

                          {/* Footer / Connect Button */}
                          <div className="pt-3 border-t border-border/40 flex items-center justify-between">
                            {repo.isConnected ? (
                              <div className="flex items-center gap-1.5 text-xs text-emerald-500 font-medium">
                                <CheckCircle2 className="h-4 w-4" />
                                <span>Connected</span>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                className="w-full h-8 text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
                                disabled={connectingId === repo.id}
                                onClick={() => handleConnect(repo)}
                              >
                                {connectingId === repo.id ? (
                                  <>
                                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                    Connecting...
                                  </>
                                ) : (
                                  <>
                                    <Plus className="h-3.5 w-3.5" />
                                    Connect to Workspace
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
