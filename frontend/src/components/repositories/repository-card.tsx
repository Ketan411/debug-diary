"use client";

import { Github, MoreHorizontal, RefreshCw, ExternalLink } from "lucide-react";

import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import { useState } from "react";
import { toast } from "sonner";
import { repositoriesApi } from "@/lib/api";

interface RepositoryCardProps {
  id?: string | undefined;
  name: string;
  description: string;
  status: "Connected" | "Disconnected" | "Syncing";
  lastSynced: string;
  commitsAnalyzed: string;
  bugFixesDetected: string;
  githubUrl?: string | undefined;
  onSyncComplete?: (() => void) | undefined;
}

export function RepositoryCard({
  id,
  name,
  description,
  status,
  lastSynced,
  commitsAnalyzed,
  bugFixesDetected,
  githubUrl,
  onSyncComplete,
}: RepositoryCardProps) {
  const [syncing, setSyncing] = useState(false);
  const isConnected = status === "Connected";

  const handleSync = async () => {
    if (!id) {
      toast.info("Repository synced.");
      return;
    }
    setSyncing(true);
    try {
      await repositoriesApi.sync(id);
      toast.success(`Synced ${name}`, {
        description: "Latest commits and pull requests updated.",
      });
      onSyncComplete?.();
    } catch (err) {
      toast.error("Failed to sync repository", {
        description: (err as Error).message,
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleToggleConnection = async () => {
    if (!id) return;
    try {
      if (isConnected) {
        await repositoriesApi.disconnect(id);
        toast.success(`Disconnected ${name}`, {
          description: "Repository marked as disconnected.",
        });
      } else {
        await repositoriesApi.reconnect(id);
        toast.success(`Reconnected ${name}`, {
          description: "Repository is now connected and active.",
        });
      }
      onSyncComplete?.();
    } catch (err) {
      toast.error(`Failed to ${isConnected ? "disconnect" : "reconnect"} repository`, {
        description: (err as Error).message,
      });
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      await repositoriesApi.delete(id);
      toast.success(`Removed ${name}`, {
        description: "Repository removed from workspace.",
      });
      onSyncComplete?.();
    } catch (err) {
      toast.error("Failed to remove repository", {
        description: (err as Error).message,
      });
    }
  };

  return (
    <Card className="bg-card/60">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-background">
              <Github className="h-5 w-5 text-foreground" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-foreground">{name}</h3>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          </div>
          <Badge
            variant={isConnected ? "default" : "secondary"}
            className={cn(
              "shrink-0",
              isConnected
                ? "border-transparent bg-primary/15 text-primary hover:bg-primary/15"
                : "border-muted-foreground/30 bg-muted/50 text-muted-foreground"
            )}
          >
            {syncing ? "Syncing..." : status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Last synced</p>
            <p className="mt-0.5 text-sm font-medium text-foreground">{lastSynced}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Commits analyzed</p>
            <p className="mt-0.5 text-sm font-medium text-foreground">{commitsAnalyzed}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Bug fixes detected</p>
            <p className="mt-0.5 text-sm font-medium text-foreground">{bugFixesDetected}</p>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <div className="flex items-center gap-2">
          {isConnected ? (
            <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
              <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} />
              {syncing ? "Syncing..." : "Sync Now"}
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={handleToggleConnection}>
              Reconnect
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const url = githubUrl || `https://github.com/${name}`;
              window.open(url, "_blank");
            }}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View Repository
          </Button>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">More actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleSync} disabled={!isConnected || syncing}>
              Sync Now
            </DropdownMenuItem>
            <DropdownMenuItem
              className={cn(
                isConnected
                  ? "text-amber-500 focus:text-amber-500"
                  : "text-primary focus:text-primary"
              )}
              onClick={handleToggleConnection}
            >
              {isConnected ? "Disconnect" : "Reconnect"}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={handleDelete}
            >
              Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardFooter>
    </Card>
  );
}
