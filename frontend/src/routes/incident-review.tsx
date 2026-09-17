import { useState, useEffect, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertCircle,
  Check,
  Edit3,
  ExternalLink,
  FileCode2,
  GitBranch,
  GitCommit,
  GitPullRequest,
  RefreshCw,
  ShieldAlert,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { incidentsApi } from "@/lib/api";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/incident-review")({
  head: () => ({
    meta: [
      { title: "Incident Review — DebugDiary" },
      {
        name: "description",
        content:
          "Review AI-generated debugging incidents before they become verified knowledge in DebugDiary.",
      },
      { property: "og:title", content: "Incident Review — DebugDiary" },
      {
        property: "og:description",
        content:
          "Human verification stage for AI-generated debugging incidents.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: IncidentReviewPage,
});

interface ReviewIncident {
  id: string;
  title: string;
  category: string;
  tags: string[];
  confidence: number;
  symptom: string;
  rootCause: string;
  resolution: string;
  affectedFiles: string[];
  repository: string;
  commitMessage: string;
  commitSha: string;
  pullRequest: string;
  evidenceFiles: string[];
  githubUrl?: string | undefined;
}

const initialIncident: ReviewIncident = {
  id: "review-1",
  title: "JWT Refresh Retry Loop",
  category: "Authentication",
  tags: ["JWT", "Axios", "Authentication"],
  confidence: 94,
  symptom:
    "Users were repeatedly redirected to the login page after their access token expired.",
  rootCause:
    "The refresh request was not correctly attaching the newly generated access token to the retry request.",
  resolution:
    "Attach the refreshed token to the original request and allow the retry operation to execute only once.",
  affectedFiles: ["src/auth/interceptor.ts", "src/services/auth.ts"],
  repository: "acme/web-app",
  commitMessage: "Fix JWT refresh retry loop",
  commitSha: "a8f3c21",
  pullRequest: "PR #48",
  evidenceFiles: ["src/auth/interceptor.ts", "src/services/auth.ts"],
};

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
        {label}
      </p>
      <div className="text-sm leading-relaxed text-foreground">{children}</div>
    </div>
  );
}

function FileList({ files }: { files: string[] }) {
  return (
    <ul className="space-y-1.5">
      {files.map((file) => (
        <li
          key={file}
          className="flex items-center gap-2 rounded-md border border-border/60 bg-secondary/40 px-2.5 py-1.5 text-xs text-secondary-foreground"
        >
          <FileCode2 className="h-3.5 w-3.5 text-muted-foreground" />
          <code className="font-mono">{file}</code>
        </li>
      ))}
    </ul>
  );
}

function EditIncidentDialog({
  incident,
  open,
  onOpenChange,
  onSave,
}: {
  incident: ReviewIncident;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updated: ReviewIncident) => void;
}) {
  const [form, setForm] = useState<ReviewIncident>(incident);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSave(form);
    onOpenChange(false);
    toast.success("Incident updated", {
      description: "Your edits have been saved for review.",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Incident</DialogTitle>
          <DialogDescription>
            Make changes to the AI-generated incident before approving or rejecting it.
          </DialogDescription>
        </DialogHeader>

        <form id="edit-incident-form" onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={form.category}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, category: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tags">Tags</Label>
              <Input
                id="tags"
                value={form.tags.join(", ")}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    tags: event.target.value.split(",").map((tag) => tag.trim()),
                  }))
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="symptom">Symptom</Label>
            <Textarea
              id="symptom"
              rows={3}
              value={form.symptom}
              onChange={(event) => setForm((prev) => ({ ...prev, symptom: event.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rootCause">Root Cause</Label>
            <Textarea
              id="rootCause"
              rows={3}
              value={form.rootCause}
              onChange={(event) => setForm((prev) => ({ ...prev, rootCause: event.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="resolution">Resolution</Label>
            <Textarea
              id="resolution"
              rows={3}
              value={form.resolution}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, resolution: event.target.value }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="affectedFiles">Affected Files</Label>
            <Textarea
              id="affectedFiles"
              rows={3}
              value={form.affectedFiles.join("\n")}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  affectedFiles: event.target.value.split("\n").map((line) => line.trim()),
                }))
              }
            />
            <p className="text-xs text-muted-foreground">Enter one file path per line.</p>
          </div>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="edit-incident-form">
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function IncidentReviewPage() {
  const [queue, setQueue] = useState<ReviewIncident[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [merging, setMerging] = useState(false);

  const loadQueue = useCallback(() => {
    setLoading(true);
    incidentsApi
      .getReviewQueue()
      .then((res) => {
        setQueue(res.incidents);
        setCurrentIndex(0);
      })
      .catch((err) => {
        console.error("Failed to load review queue:", err);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const incident = queue[currentIndex] || queue[0];

  const handleApprove = async () => {
    if (!incident?.id) return;
    setSubmitting(true);
    try {
      await incidentsApi.review(incident.id, "approve");
      toast.success("Incident approved", {
        description: `"${incident.title}" has been added to the verified knowledge base.`,
      });
      setQueue((prev) => {
        const nextQueue = prev.filter((i) => i.id !== incident.id);
        if (currentIndex >= nextQueue.length) {
          setCurrentIndex(Math.max(0, nextQueue.length - 1));
        }
        return nextQueue;
      });
    } catch (err) {
      toast.error("Failed to approve incident", {
        description: (err as Error).message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveAndMerge = async () => {
    if (!incident?.id) return;
    setMerging(true);
    try {
      const res = await incidentsApi.review(incident.id, "approve", undefined, true);
      toast.success("Merged & Approved on GitHub!", {
        description:
          res.message ||
          `PR for "${incident.title}" was merged on GitHub and verified in knowledge base.`,
      });
      setQueue((prev) => {
        const nextQueue = prev.filter((i) => i.id !== incident.id);
        if (currentIndex >= nextQueue.length) {
          setCurrentIndex(Math.max(0, nextQueue.length - 1));
        }
        return nextQueue;
      });
    } catch (err) {
      toast.error("GitHub Merge Failed", {
        description: (err as Error).message,
      });
    } finally {
      setMerging(false);
    }
  };

  const handleReject = async () => {
    if (!incident?.id) return;
    setSubmitting(true);
    try {
      await incidentsApi.review(incident.id, "reject");
      toast.error("Incident rejected", {
        description: `"${incident.title}" has been removed from the review queue.`,
      });
      setQueue((prev) => {
        const nextQueue = prev.filter((i) => i.id !== incident.id);
        if (currentIndex >= nextQueue.length) {
          setCurrentIndex(Math.max(0, nextQueue.length - 1));
        }
        return nextQueue;
      });
    } catch (err) {
      toast.error("Failed to reject incident", {
        description: (err as Error).message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSave = async (updated: ReviewIncident) => {
    if (!updated?.id) return;
    setSubmitting(true);
    try {
      await incidentsApi.review(updated.id, "edit", {
        title: updated.title,
        category: updated.category,
        tags: updated.tags,
        symptom: updated.symptom,
        rootCause: updated.rootCause,
        resolution: updated.resolution,
        affectedFiles: updated.affectedFiles,
      });
      setQueue((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      toast.success("Incident updated", {
        description: "Your edits have been saved.",
      });
    } catch (err) {
      toast.error("Failed to update incident", {
        description: (err as Error).message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell title="Incident Review">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Incident Review
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Review AI-generated debugging incidents before they become verified knowledge.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadQueue}
              disabled={loading}
              title="Refresh queue"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              Refresh
            </Button>
            <div className="flex items-center gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-1.5 text-warning">
              <AlertCircle className="h-4 w-4" />
              <span className="text-xs font-medium">
                {queue.length} {queue.length === 1 ? "incident" : "incidents"} awaiting review
              </span>
            </div>
          </div>
        </div>

        {queue.length === 0 && !loading ? (
          <Card className="border-border bg-card/60">
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-success/30 bg-success/10 text-success">
                <Check className="h-6 w-6" />
              </div>
              <h2 className="mt-4 text-base font-semibold text-foreground">Review queue is empty!</h2>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                All captured bug fixes have been reviewed and verified. New incidents will automatically appear here when GitHub pushes are analyzed.
              </p>
            </CardContent>
          </Card>
        ) : incident ? (
          <>
            {queue.length > 1 && (
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Showing incident {currentIndex + 1} of {queue.length}
                </span>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={currentIndex === 0}
                    onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={currentIndex >= queue.length - 1}
                    onClick={() => setCurrentIndex((prev) => Math.min(queue.length - 1, prev + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}

            <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
              {/* Left column — AI-generated incident */}
              <Card className="border-border bg-card/60">
                <CardHeader className="p-5 pb-0">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-2">
                      <Badge
                        variant="outline"
                        className="rounded-full border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
                      >
                        AI Generated
                      </Badge>
                      <CardTitle className="text-base font-semibold leading-tight text-foreground">
                        {incident.title}
                      </CardTitle>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{incident.category}</span>
                        <span className="text-[10px] text-muted-foreground/60">•</span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {incident.tags.map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center rounded-full border border-border bg-secondary/60 px-2 py-0.5 text-[10px] font-medium text-secondary-foreground"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-[11px] font-medium text-success">
                      <Check className="h-3.5 w-3.5" />
                      {incident.confidence}% confidence
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-5 p-5 pt-5">
                  <Section label="Symptom">{incident.symptom}</Section>
                  <Section label="Root Cause">{incident.rootCause}</Section>
                  <Section label="Resolution">{incident.resolution}</Section>
                  <Section label="Affected Files">
                    <FileList files={incident.affectedFiles} />
                  </Section>
                </CardContent>
              </Card>

              {/* Right column — source evidence */}
              <div className="space-y-6">
                <Card className="border-border bg-card/60">
                  <CardHeader className="p-5 pb-0">
                    <CardTitle className="text-sm font-semibold text-foreground">
                      Source Evidence
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 p-5 pt-4">
                    <div className="space-y-3 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-xs text-muted-foreground">Repository</span>
                        <span className="flex items-center gap-1.5 font-medium text-foreground">
                          <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                          {incident.repository}
                        </span>
                      </div>

                      {incident.pullRequest && (
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-xs text-muted-foreground">Pull Request</span>
                          <span className="flex items-center gap-1.5 font-medium text-primary">
                            <GitPullRequest className="h-3.5 w-3.5" />
                            {incident.pullRequest}
                          </span>
                        </div>
                      )}

                      {incident.commitSha && (
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-xs text-muted-foreground">Commit</span>
                          <span className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                            <GitCommit className="h-3.5 w-3.5" />
                            {incident.commitSha.slice(0, 7)}
                          </span>
                        </div>
                      )}

                      {incident.commitMessage && (
                        <div className="space-y-1">
                          <span className="text-xs text-muted-foreground">Commit Message</span>
                          <p className="rounded-md border border-border/60 bg-secondary/40 p-2 font-mono text-xs text-secondary-foreground">
                            {incident.commitMessage}
                          </p>
                        </div>
                      )}

                      {incident.githubUrl && (
                        <div className="pt-1">
                          <a
                            href={incident.githubUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            View on GitHub
                          </a>
                        </div>
                      )}
                    </div>

                    <div className="flex items-start gap-2 rounded-md border border-border/60 bg-secondary/40 p-3">
                      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        This incident was generated from GitHub development history. Verify the source
                        before approving.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Bottom action bar */}
            <Card className="border-border bg-card/60">
              <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Only approved incidents are added to the verified knowledge base.
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Button
                    variant="outline"
                    className="border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={handleReject}
                    disabled={submitting || merging}
                  >
                    <X className="h-4 w-4" />
                    Reject
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => setEditOpen(true)}
                    disabled={submitting || merging}
                  >
                    <Edit3 className="h-4 w-4" />
                    Edit
                  </Button>

                  <Button
                    variant={incident.pullRequest ? "outline" : "default"}
                    onClick={handleApprove}
                    disabled={submitting || merging}
                    title={
                      incident.pullRequest
                        ? "Verify incident in DebugDiary knowledge base without merging on GitHub"
                        : "Verify incident in DebugDiary knowledge base"
                    }
                  >
                    <Check className="h-4 w-4" />
                    {submitting
                      ? "Approving..."
                      : incident.pullRequest
                      ? "Approve (KB only)"
                      : "Approve"}
                  </Button>

                  {incident.pullRequest && incident.pullRequest.includes("#") && (
                    <Button
                      className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-sm font-medium"
                      onClick={handleApproveAndMerge}
                      disabled={submitting || merging}
                    >
                      <GitPullRequest className={cn("h-4 w-4", merging && "animate-spin")} />
                      {merging ? "Merging on GitHub..." : "Approve & Merge on GitHub"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <EditIncidentDialog
              incident={incident}
              open={editOpen}
              onOpenChange={setEditOpen}
              onSave={handleEditSave}
            />
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
