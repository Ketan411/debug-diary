import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle, CheckCircle2, Clock, GitBranch } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { StatCard } from "@/components/dashboard/stat-card";
import { IncidentTrendsChart } from "@/components/dashboard/incident-trends-chart";
import { RecentIncidents } from "@/components/dashboard/recent-incidents";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { analyticsApi, DashboardData, setStoredToken, authApi } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — DebugDiary" },
      {
        name: "description",
        content:
          "Overview of incidents, verified fixes and connected repositories in your DebugDiary workspace.",
      },
      { property: "og:title", content: "Dashboard — DebugDiary" },
      {
        property: "og:description",
        content: "Track debugging knowledge, incident trends and pending reviews.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("token");
      const provider = params.get("provider");
      const urlName = params.get("name");
      const urlEmail = params.get("email");

      if (token) {
        setStoredToken(token);
        if (urlName && urlEmail) {
          const userObj = {
            id: "",
            name: decodeURIComponent(urlName),
            email: decodeURIComponent(urlEmail),
            department: "Engineering",
          };
          localStorage.setItem("debugdiary_user", JSON.stringify(userObj));
          window.dispatchEvent(new Event("auth_change"));
        }

        authApi
          .getMe()
          .then((user) => {
            localStorage.setItem("debugdiary_user", JSON.stringify(user));
            window.dispatchEvent(new Event("auth_change"));
            toast.success(`Welcome, ${user.name}!`, {
              description:
                provider === "github"
                  ? "Signed in with GitHub successfully"
                  : undefined,
            });
          })
          .catch(console.error);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }

    analyticsApi
      .getDashboard()
      .then((res) => {
        setData(res);
      })
      .catch((err) => {
        console.error("Failed to load dashboard data:", err);
      })
      .finally(() => setLoading(false));
  }, []);

  const stats = [
    {
      label: "Total Incidents",
      value: data ? String(data.stats.totalIncidents) : "8",
      icon: AlertCircle,
      hint: "All captured bug fixes",
    },
    {
      label: "Verified",
      value: data ? String(data.stats.verified) : "6",
      icon: CheckCircle2,
      hint: "Evidence confirmed",
    },
    {
      label: "Pending Review",
      value: data ? String(data.stats.pendingReview) : "2",
      icon: Clock,
      hint: "Awaiting team review",
    },
    {
      label: "Repositories",
      value: data ? String(data.stats.repositories) : "2",
      icon: GitBranch,
      hint: "Connected sources",
    },
  ];

  return (
    <AppShell title="Dashboard">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Good morning</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Here&apos;s what&apos;s happening in your debugging workspace.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <StatCard key={stat.label} {...stat} />
          ))}
        </div>

        <IncidentTrendsChart data={data?.trends} />
        <RecentIncidents incidents={data?.recentIncidents} />
        <QuickActions />
      </div>
    </AppShell>
  );
}
