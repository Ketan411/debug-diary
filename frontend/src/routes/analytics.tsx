import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertCircle,
  BarChart2,
  CheckCircle2,
  Clock,
  FileCode2,
  Flame,
  GitBranch,
  RefreshCw,
  TrendingUp,
} from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { StatCard } from "@/components/dashboard/stat-card";
import { IncidentTrendsChart } from "@/components/dashboard/incident-trends-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { analyticsApi, DashboardData } from "@/lib/api";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics - DebugDiary" },
      { name: "description", content: "Analytics in your DebugDiary debugging knowledge workspace." },
      { property: "og:title", content: "Analytics - DebugDiary" },
      { property: "og:description", content: "Analytics in your DebugDiary debugging knowledge workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AnalyticsPage,
});

interface HotspotData {
  topCategories: Array<{ category: string; count: number }>;
  hotspotFiles: Array<{ filePath: string; incidentCount: number }>;
}

function AnalyticsPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [hotspots, setHotspots] = useState<HotspotData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      analyticsApi.getDashboard().catch(() => null),
      analyticsApi.getHotspots().catch(() => null),
    ])
      .then(([dash, hot]) => {
        if (dash) setDashboard(dash);
        if (hot) setHotspots(hot as unknown as HotspotData);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
    const handleRepoChange = () => {
      loadData();
    };
    window.addEventListener("repo_change", handleRepoChange);
    return () => {
      window.removeEventListener("repo_change", handleRepoChange);
    };
  }, []);

  const total = dashboard?.stats.totalIncidents ?? 8;
  const verified = dashboard?.stats.verified ?? 6;
  const pending = dashboard?.stats.pendingReview ?? 2;
  const repos = dashboard?.stats.repositories ?? 2;
  const verificationRate = total > 0 ? Math.round((verified / total) * 100) : 0;

  const stats = [
    {
      label: "Total Captured",
      value: String(total),
      icon: AlertCircle,
      hint: "All bug fixes tracked",
    },
    {
      label: "Verified Knowledge",
      value: String(verified),
      icon: CheckCircle2,
      hint: "Confirmed by engineers",
    },
    {
      label: "Pending Review",
      value: String(pending),
      icon: Clock,
      hint: "Awaiting approval",
    },
    {
      label: "Verification Rate",
      value: `${verificationRate}%`,
      icon: TrendingUp,
      hint: "Quality ratio",
    },
  ];

  return (
    <AppShell title="Analytics">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Analytics &amp; Insights
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Understand bug frequency patterns, fragile files, and resolution velocity.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh Data
          </Button>
        </div>

        {/* Overview Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <StatCard key={stat.label} {...stat} />
          ))}
        </div>

        {/* Trends Chart */}
        <IncidentTrendsChart data={dashboard?.trends} />

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Hotspot Fragile Files */}
          <Card className="border-border bg-card/60">
            <CardHeader className="p-5 pb-3">
              <div className="flex items-center gap-2">
                <Flame className="h-4 w-4 text-destructive" />
                <CardTitle className="text-sm font-semibold text-foreground">
                  Hotspot Files (Most Bug-Prone)
                </CardTitle>
              </div>
              <p className="text-xs text-muted-foreground">
                Files frequently implicated in bug resolutions and commits.
              </p>
            </CardHeader>
            <CardContent className="space-y-3 p-5 pt-0">
              {hotspots?.hotspotFiles && hotspots.hotspotFiles.length > 0 ? (
                <div className="space-y-2">
                  {hotspots.hotspotFiles.slice(0, 7).map((item) => (
                    <div
                      key={item.filePath}
                      className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-secondary/30 p-2.5 text-xs"
                    >
                      <span className="flex items-center gap-2 truncate font-mono text-foreground">
                        <FileCode2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate">{item.filePath}</span>
                      </span>
                      <span className="shrink-0 rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 font-medium text-destructive">
                        {item.incidentCount} {item.incidentCount === 1 ? "fix" : "fixes"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No hotspot files calculated yet.</p>
              )}
            </CardContent>
          </Card>

          {/* Category Breakdown */}
          <Card className="border-border bg-card/60">
            <CardHeader className="p-5 pb-3">
              <div className="flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-semibold text-foreground">
                  Incident Categories
                </CardTitle>
              </div>
              <p className="text-xs text-muted-foreground">
                Distribution of bug types across your codebase.
              </p>
            </CardHeader>
            <CardContent className="space-y-4 p-5 pt-0">
              {hotspots?.topCategories && hotspots.topCategories.length > 0 ? (
                <div className="space-y-3">
                  {hotspots.topCategories.map((item) => {
                    const percentage = total > 0 ? Math.round((item.count / total) * 100) : 0;
                    return (
                      <div key={item.category} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-foreground">{item.category}</span>
                          <span className="text-muted-foreground">
                            {item.count} ({percentage}%)
                          </span>
                        </div>
                        <Progress value={percentage} className="h-2" />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No category data available yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
