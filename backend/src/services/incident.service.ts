import { prisma } from "../db/prisma";
import {
  formatRelativeTime,
  statusToDisplay,
  getEvidence,
} from "../utils/format";

// ─── Public Formatters ────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function formatIncident(incident: any) {
  const { evidence, evidenceType } = getEvidence(incident);
  return {
    id: incident.id,
    title: incident.title,
    category: incident.category,
    tags: incident.tags ?? [],
    symptom: incident.symptom,
    rootCause: incident.rootCause,
    resolution: incident.resolution,
    status: statusToDisplay(incident.status),
    repository: incident.repository?.fullName ?? "Unknown",
    githubUrl:
      incident.githubUrl ?? incident.repository?.githubUrl ?? "",
    evidence,
    evidenceType,
    updated: formatRelativeTime(incident.updatedAt),
    createdAt: incident.createdAt,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function formatReviewIncident(incident: any) {
  return {
    id: incident.id,
    title: incident.title,
    category: incident.category,
    tags: incident.tags ?? [],
    confidence: Math.round((incident.confidenceScore ?? 0) * 100),
    symptom: incident.symptom,
    rootCause: incident.rootCause,
    resolution: incident.resolution,
    affectedFiles: incident.affectedFiles ?? [],
    repository: incident.repository?.fullName ?? "Unknown",
    commitMessage: incident.commitMessage ?? "",
    commitSha: incident.commitSha ?? "",
    pullRequest: incident.pullRequest ?? "",
    evidenceFiles: incident.evidenceArtifacts?.map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (e: any) => e.filePath
    ) ?? incident.affectedFiles ?? [],
    githubUrl:
      incident.githubUrl ?? incident.repository?.githubUrl ?? "",
  };
}

// ─── List Incidents ───────────────────────────────────────────────────────────

export async function listIncidents(
  workspaceId: string,
  filters: {
    status?: string;
    category?: string;
    search?: string;
    repository?: string;
  }
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { workspaceId };

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.category && filters.category !== "All") {
    where.category = filters.category;
  }

  if (filters.repository && filters.repository !== "All") {
    where.repository = { fullName: filters.repository };
  }

  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search, mode: "insensitive" } },
      { symptom: { contains: filters.search, mode: "insensitive" } },
      { rootCause: { contains: filters.search, mode: "insensitive" } },
      { resolution: { contains: filters.search, mode: "insensitive" } },
      { category: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  const incidents = await prisma.incident.findMany({
    where,
    include: { repository: true },
    orderBy: { updatedAt: "desc" },
  });

  return incidents.map(formatIncident);
}

// ─── Review Queue ─────────────────────────────────────────────────────────────

export async function getReviewQueue(workspaceId: string, repository?: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { workspaceId, status: "pending_review" };

  if (repository && repository !== "All") {
    where.repository = { fullName: repository };
  }

  const incidents = await prisma.incident.findMany({
    where,
    include: { repository: true, evidenceArtifacts: true },
    orderBy: { createdAt: "asc" },
  });

  return {
    incidents: incidents.map(formatReviewIncident),
    total: incidents.length,
  };
}

// ─── Review Action ────────────────────────────────────────────────────────────

export async function reviewIncident(
  incidentId: string,
  workspaceId: string,
  userId: string,
  action: "approve" | "reject" | "edit",
  edits?: {
    title?: string;
    category?: string;
    tags?: string[];
    symptom?: string;
    rootCause?: string;
    resolution?: string;
    affectedFiles?: string[];
  },
  mergeOnGithub?: boolean
) {
  const incident = await prisma.incident.findFirst({
    where: { id: incidentId, workspaceId },
    include: { repository: true },
  });
  if (!incident) throw new Error("Incident not found");

  let mergedOnGithub = false;
  let prNumber: string | null = null;

  if (action === "approve" && mergeOnGithub) {
    const prMatch = incident.pullRequest?.match(/#(\d+)/);
    prNumber = prMatch ? prMatch[1] : null;
    if (!prNumber) {
      throw new Error("No Pull Request number associated with this incident.");
    }

    const repoFullName = incident.repository?.fullName;
    if (!repoFullName) {
      throw new Error("No connected GitHub repository found for this incident.");
    }

    // Get user's githubAccessToken or fallback to workspace owner
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { githubAccessToken: true },
    });
    let token = user?.githubAccessToken;

    if (!token) {
      const ownerMember = await prisma.workspaceMember.findFirst({
        where: { workspaceId, role: "OWNER" },
        include: { user: true },
      });
      token = ownerMember?.user?.githubAccessToken ?? null;
    }

    if (!token) {
      throw new Error(
        "GitHub access token not found. Please connect your GitHub account in Settings to merge PRs directly."
      );
    }

    // Call GitHub Pull Request Merge API
    const mergeRes = await fetch(
      `https://api.github.com/repos/${repoFullName}/pulls/${prNumber}/merge`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "DebugDiary-App",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          commit_title: `Merge pull request #${prNumber} from ${repoFullName} (via DebugDiary)`,
          commit_message: `Approved and verified via DebugDiary: ${incident.title}`,
          merge_method: "merge",
        }),
      }
    );

    const mergeData = (await mergeRes.json().catch(() => ({}))) as {
      sha?: string;
      merged?: boolean;
      message?: string;
    };

    if (!mergeRes.ok || !mergeData.merged) {
      const errMsg =
        mergeData.message ||
        `GitHub merge failed with HTTP status ${mergeRes.status}`;
      throw new Error(`GitHub merge error: ${errMsg}`);
    }

    mergedOnGithub = true;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let updateData: any = {};

  if (action === "approve") {
    let resolution = incident.resolution;
    if (mergedOnGithub && prNumber) {
      if (
        !resolution.includes("merged into default branch") &&
        !resolution.includes("Merged on GitHub")
      ) {
        resolution = `${resolution} (Merged on GitHub via PR #${prNumber})`;
      }
    }

    updateData = {
      status: "verified",
      verifiedById: userId,
      verifiedAt: new Date(),
      resolution,
    };
  } else if (action === "reject") {
    updateData = { status: "rejected" };
  } else if (action === "edit" && edits) {
    // Only include fields that were actually sent
    updateData = Object.fromEntries(
      Object.entries(edits).filter(([, v]) => v !== undefined)
    );
  }

  const updated = await prisma.incident.update({
    where: { id: incidentId },
    data: updateData,
    include: { repository: true },
  });

  if (action === "approve" && incident.repositoryId) {
    await prisma.repository.update({
      where: { id: incident.repositoryId },
      data: { bugFixesDetected: { increment: 1 } },
    });
  }

  const messages = {
    approve: mergedOnGithub
      ? `PR #${prNumber} successfully merged on GitHub and incident verified!`
      : "Incident approved successfully",
    reject: "Incident rejected",
    edit: "Incident updated",
  };

  return {
    incident: formatIncident(updated),
    message: messages[action],
    mergedOnGithub,
  };
}

// ─── Get By ID ────────────────────────────────────────────────────────────────

export async function getIncidentById(
  incidentId: string,
  workspaceId: string
) {
  const incident = await prisma.incident.findFirst({
    where: { id: incidentId, workspaceId },
    include: { repository: true, evidenceArtifacts: true },
  });
  if (!incident) throw new Error("Incident not found");
  return formatIncident(incident);
}
