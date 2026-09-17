import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { prisma } from "../db/prisma";
import { statusToDisplay } from "../utils/format";

// ─── Dashboard Analytics ──────────────────────────────────────────────────────

export async function getDashboardAnalytics(workspaceId: string) {
  // Parallel stat queries
  const [totalIncidents, verified, pendingReview, repositories] =
    await Promise.all([
      prisma.incident.count({ where: { workspaceId } }),
      prisma.incident.count({ where: { workspaceId, status: "verified" } }),
      prisma.incident.count({
        where: { workspaceId, status: "pending_review" },
      }),
      prisma.repository.count({ where: { workspaceId } }),
    ]);

  // Parallel trend queries — last 6 months
  const now = new Date();
  const trendPromises = Array.from({ length: 6 }, (_, i) => {
    const date = subMonths(now, 5 - i);
    const start = startOfMonth(date);
    const end = endOfMonth(date);
    return prisma.incident
      .count({
        where: {
          workspaceId,
          createdAt: { gte: start, lte: end },
        },
      })
      .then((count) => ({ month: format(date, "MMM"), incidents: count }));
  });
  const trends = await Promise.all(trendPromises);

  // Recent incidents (last 5, any status)
  const recentRaw = await prisma.incident.findMany({
    where: { workspaceId },
    orderBy: { updatedAt: "desc" },
    take: 5,
  });

  const recentIncidents = recentRaw.map((i) => ({
    id: i.id,
    title: i.title,
    category: i.category,
    // Dashboard uses short "Pending" label
    status:
      i.status === "verified"
        ? "Verified"
        : i.status === "rejected"
        ? "Rejected"
        : "Pending",
    updated: formatTimeAgo(i.updatedAt),
  }));

  return {
    stats: { totalIncidents, verified, pendingReview, repositories },
    trends,
    recentIncidents,
  };
}

// ─── Hotspot Analytics ────────────────────────────────────────────────────────

export async function getHotspots(workspaceId: string) {
  const incidents = await prisma.incident.findMany({
    where: { workspaceId, status: "verified" },
    select: { affectedFiles: true, category: true, tags: true },
  });

  // Count category frequencies
  const categoryMap: Record<string, number> = {};
  const fileMap: Record<string, number> = {};

  for (const inc of incidents) {
    categoryMap[inc.category] = (categoryMap[inc.category] ?? 0) + 1;
    for (const f of inc.affectedFiles) {
      fileMap[f] = (fileMap[f] ?? 0) + 1;
    }
  }

  const topCategories = Object.entries(categoryMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([category, count]) => ({ category, count }));

  const hotspotFiles = Object.entries(fileMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([filePath, incidentCount]) => ({ filePath, incidentCount }));

  return { topCategories, hotspotFiles };
}

// ─── Short Time Formatter (for dashboard) ────────────────────────────────────

function formatTimeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "1d ago";
  return `${days}d ago`;
}
