import { GitPullRequest, GitCommit, ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type IncidentStatus = "Verified" | "Pending Review";
export type IncidentCategory = "Authentication" | "Database" | "API" | "CI/CD" | "Frontend" | "Infrastructure";

export interface Incident {
  id: string;
  title: string;
  category: IncidentCategory;
  tags: string[];
  symptom: string;
  rootCause: string;
  resolution: string;
  status: IncidentStatus;
  repository: string;
  evidence: string;
  evidenceType: "pr" | "commit";
  updated: string;
}

interface IncidentCardProps {
  incident: Incident;
}

function StatusBadge({ status }: { status: IncidentStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-full border px-2 py-0.5 text-[11px] font-medium",
        status === "Verified"
          ? "border-success/30 bg-success/10 text-success"
          : "border-warning/30 bg-warning/10 text-warning",
      )}
    >
      {status}
    </Badge>
  );
}

function EvidenceLink({ incident }: { incident: Incident }) {
  const Icon = incident.evidenceType === "pr" ? GitPullRequest : GitCommit;

  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <span className="font-medium text-foreground">{incident.repository}</span>
      <span className="flex items-center gap-1 text-primary transition-colors hover:text-primary/80">
        <Icon className="h-3 w-3" />
        {incident.evidence}
        <ExternalLink className="h-3 w-3" />
      </span>
    </div>
  );
}

export function IncidentCard({ incident }: IncidentCardProps) {
  return (
    <Card
      role="button"
      tabIndex={0}
      className="group cursor-pointer border-border bg-card/60 transition-colors hover:border-border/80 hover:bg-card focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      <CardHeader className="gap-3 p-5 pb-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold leading-tight text-foreground group-hover:text-primary transition-colors">
              {incident.title}
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">{incident.category}</span>
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
          <StatusBadge status={incident.status} />
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-5 pt-4">
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">Symptom</p>
            <p className="text-sm leading-relaxed text-foreground">{incident.symptom}</p>
          </div>

          <div className="space-y-1">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">Root Cause</p>
            <p className="text-sm leading-relaxed text-foreground">{incident.rootCause}</p>
          </div>

          <div className="space-y-1">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">Resolution</p>
            <p className="text-sm leading-relaxed text-foreground">{incident.resolution}</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <EvidenceLink incident={incident} />
          <span className="text-xs text-muted-foreground">Updated {incident.updated}</span>
        </div>
      </CardContent>
    </Card>
  );
}
