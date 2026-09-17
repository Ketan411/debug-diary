import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCode2,
  GitBranch,
  GitCommit,
  GitPullRequest,
  RefreshCw,
  Sparkles,
} from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { incidentsApi, Incident } from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/incidents/$id")({
  head: () => ({
    meta: [
      { title: "Incident Details — DebugDiary" },
      {
        name: "description",
        content: "View incident details in DebugDiary.",
      },
      { property: "og:title", content: "Incident Details — DebugDiary" },
      { property: "og:description", content: "View incident details in DebugDiary." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: IncidentDetailsPage,
});

function IncidentDetailsPage() {
  const { id } = Route.useParams();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    incidentsApi
      .get(id)
      .then((res) => {
        setIncident(res.incident);
      })
      .catch((err) => {
        setError((err as Error).message);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const isVerified = incident?.status === "Verified";
  const EvidenceIcon = incident?.evidenceType === "pr" ? GitPullRequest : GitCommit;

  return (
    <AppShell title="Incident Details">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" asChild>
            <Link to="/knowledge">
              <ArrowLeft className="h-4 w-4" />
              Back to Knowledge
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/search">Search Other Fixes</Link>
          </Button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card/60 p-16 text-center">
            <RefreshCw className="h-8 w-8 animate-spin text-primary" />
            <p className="mt-4 text-sm text-muted-foreground">Loading incident details...</p>
          </div>
        ) : error || !incident ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-8 text-center">
            <h2 className="text-base font-semibold text-destructive">Incident not found</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {error || `Unable to locate incident ${id}.`}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header Card */}
            <Card className="border-border bg-card/60">
              <CardHeader className="p-6 pb-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          "rounded-full border px-2.5 py-0.5 text-xs font-medium",
                          isVerified
                            ? "border-success/30 bg-success/10 text-success"
                            : "border-warning/30 bg-warning/10 text-warning"
                        )}
                      >
                        {isVerified ? (
                          <CheckCircle2 className="mr-1 h-3.5 w-3.5 inline" />
                        ) : (
                          <Clock className="mr-1 h-3.5 w-3.5 inline" />
                        )}
                        {incident.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-xs font-medium text-muted-foreground">
                        {incident.category}
                      </span>
                      {incident.updated && (
                        <>
                          <span className="text-xs text-muted-foreground">•</span>
                          <span className="text-xs text-muted-foreground">Updated {incident.updated}</span>
                        </>
                      )}
                    </div>
                    <CardTitle className="text-xl font-bold leading-tight text-foreground">
                      {incident.title}
                    </CardTitle>
                    <div className="flex flex-wrap gap-1.5">
                      {incident.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center rounded-full border border-border bg-secondary/60 px-2.5 py-0.5 text-xs font-medium text-secondary-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {incident.githubUrl && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={incident.githubUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                        GitHub Commit/PR
                      </a>
                    </Button>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-6 p-6 pt-2">
                {/* Symptom */}
                <div className="space-y-2 rounded-lg border border-border/70 bg-secondary/30 p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Symptom / What Broke
                  </h3>
                  <p className="text-sm leading-relaxed text-foreground">{incident.symptom}</p>
                </div>

                {/* Root Cause */}
                {incident.rootCause && (
                  <div className="space-y-2 rounded-lg border border-warning/30 bg-warning/5 p-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-warning">
                      Root Cause
                    </h3>
                    <p className="text-sm leading-relaxed text-foreground">{incident.rootCause}</p>
                  </div>
                )}

                {/* Resolution */}
                {incident.resolution && (
                  <div className="space-y-2 rounded-lg border border-success/30 bg-success/5 p-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-success">
                      Resolution / How It Was Fixed
                    </h3>
                    <p className="text-sm leading-relaxed text-foreground">{incident.resolution}</p>
                  </div>
                )}

                {/* Provenance Footer */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-4 w-4" />
                    <span>Repository:</span>
                    <strong className="text-foreground">{incident.repository}</strong>
                  </div>

                  {incident.evidence && (
                    <div className="flex items-center gap-2">
                      <EvidenceIcon className="h-4 w-4 text-primary" />
                      <span>Evidence Reference:</span>
                      <strong className="text-primary">{incident.evidence}</strong>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppShell>
  );
}
