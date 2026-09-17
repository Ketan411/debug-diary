import { useEffect, useState, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, RefreshCw, Search } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IncidentCard, Incident, IncidentCategory } from "@/components/knowledge/incident-card";
import { incidentsApi } from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/knowledge")({
  head: () => ({
    meta: [
      { title: "Knowledge — DebugDiary" },
      { name: "description", content: "Verified debugging knowledge from your repositories in DebugDiary." },
      { property: "og:title", content: "Knowledge — DebugDiary" },
      { property: "og:description", content: "Verified debugging knowledge from your repositories in DebugDiary." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: KnowledgePage,
});

const filters: (IncidentCategory | "All")[] = [
  "All",
  "Authentication",
  "Database",
  "API",
  "CI/CD",
  "Frontend",
  "Infrastructure",
];

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/40 px-6 py-16 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card">
        <Search className="h-4 w-4 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-sm font-medium text-foreground">No incidents found</h3>
      <p className="mt-1 text-xs text-muted-foreground">Try a different search or filter.</p>
    </div>
  );
}

function KnowledgePage() {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<IncidentCategory | "All">("All");
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);

  const loadIncidents = useCallback(() => {
    setLoading(true);
    incidentsApi
      .list({
        category: activeFilter === "All" ? undefined : activeFilter,
        search: search.trim() || undefined,
      })
      .then((res) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setIncidents(res.incidents as any);
      })
      .catch((err) => {
        console.error("Failed to load incidents:", err);
      })
      .finally(() => setLoading(false));
  }, [activeFilter, search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadIncidents();
    }, 200);
    return () => clearTimeout(timer);
  }, [loadIncidents]);

  return (
    <AppShell title="Knowledge">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold tracking-tight text-foreground">Knowledge</h1>
              <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                {incidents.length} incidents
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Verified debugging knowledge from your repositories.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadIncidents}
              disabled={loading}
              title="Refresh incidents"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button>
              <Plus className="h-4 w-4" />
              Add Incident
            </Button>
          </div>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search incidents, root causes, tags, or symptoms..."
            className="pl-9"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {filters.map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setActiveFilter(filter)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                activeFilter === filter
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card/60 text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {filter}
            </button>
          ))}
        </div>

        {incidents.length > 0 ? (
          <div className="space-y-4">
            {incidents.map((incident) => (
              <IncidentCard key={incident.id} incident={incident} />
            ))}
          </div>
        ) : (
          <EmptyState />
        )}
      </div>
    </AppShell>
  );
}
