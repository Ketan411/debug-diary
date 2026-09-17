"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Github, Plus } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { repositoriesApi, AvailableGitHubRepo } from "@/lib/api";

interface ConnectRepositoryDialogProps {
  children: React.ReactNode;
  onConnected?: () => void;
}

export function ConnectRepositoryDialog({ children, onConnected }: ConnectRepositoryDialogProps) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [availableRepos, setAvailableRepos] = useState<AvailableGitHubRepo[]>([]);
  const [githubConnected, setGithubConnected] = useState(false);

  useEffect(() => {
    if (open) {
      repositoriesApi
        .listAvailableGitHub()
        .then((res) => {
          setGithubConnected(res.connected);
          setAvailableRepos(res.repositories?.filter((r) => !r.isConnected) || []);
        })
        .catch(() => {
          // ignore
        });
    }
  }, [open]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);

    try {
      const res = await repositoriesApi.connect({ url, description: description || undefined });
      setIsLoading(false);
      setOpen(false);
      setUrl("");
      setDescription("");
      toast.success("Repository connected successfully.");

      if (res.repository?.id) {
        repositoriesApi.sync(res.repository.id).catch(console.error);
      }

      onConnected?.();
    } catch (err) {
      setIsLoading(false);
      toast.error("Failed to connect repository", {
        description: (err as Error).message,
      });
    }
  };

  const handleSelectRepo = (repo: AvailableGitHubRepo) => {
    setUrl(repo.htmlUrl);
    setDescription(repo.description || "");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Connect a GitHub Repository</DialogTitle>
          <DialogDescription>
            Import commit and pull request history to build your debugging knowledge base.
          </DialogDescription>
        </DialogHeader>

        {githubConnected && availableRepos.length > 0 && (
          <div className="space-y-2 pb-2">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Github className="h-3.5 w-3.5" />
              Quick Select from Your Repositories:
            </Label>
            <div className="max-h-36 overflow-y-auto space-y-1.5 rounded-md border border-border/60 bg-muted/20 p-2">
              {availableRepos.map((repo) => (
                <button
                  key={repo.id}
                  type="button"
                  onClick={() => handleSelectRepo(repo)}
                  className={`w-full text-left p-2 rounded text-xs transition-colors flex items-center justify-between ${
                    url === repo.htmlUrl
                      ? "bg-primary/15 text-primary font-medium border border-primary/30"
                      : "hover:bg-accent/80 text-foreground"
                  }`}
                >
                  <div className="truncate mr-2">
                    <span className="font-semibold">{repo.name}</span>
                    {repo.description && (
                      <span className="text-muted-foreground ml-1.5 text-[11px] truncate">
                        — {repo.description}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0 uppercase font-mono">
                    {repo.isPrivate ? "Private" : "Public"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="repo-url">GitHub Repository URL</Label>
            <Input
              id="repo-url"
              type="url"
              placeholder="https://github.com/owner/repository"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="repo-desc">Description (Optional)</Label>
            <Input
              id="repo-desc"
              type="text"
              placeholder="e.g. Main backend API service"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="gap-1.5">
              <Plus className="h-4 w-4" />
              {isLoading ? "Connecting..." : "Connect Repository"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
