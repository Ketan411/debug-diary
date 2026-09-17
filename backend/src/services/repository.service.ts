import { prisma } from "../db/prisma";
import { formatRelativeTime, formatNumber } from "../utils/format";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FormattedRepository {
  id: string;
  name: string;
  description: string;
  status: string;
  lastSynced: string;
  commitsAnalyzed: string;
  bugFixesDetected: string;
  githubUrl: string;
}

// ─── List Repositories ────────────────────────────────────────────────────────

export async function listRepositories(
  workspaceId: string
): Promise<FormattedRepository[]> {
  const repos = await prisma.repository.findMany({
    where: { workspaceId },
    include: {
      _count: {
        select: { incidents: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  return repos.map((repo) => {
    const effectiveBugFixes = Math.max(repo.bugFixesDetected, repo._count?.incidents || 0);
    return formatRepository({ ...repo, bugFixesDetected: effectiveBugFixes });
  });
}

// ─── Connect Repository ───────────────────────────────────────────────────────

export async function connectRepository(
  workspaceId: string,
  url: string,
  description?: string
): Promise<FormattedRepository> {
  const fullName = extractRepoFullName(url);
  const githubUrl = `https://github.com/${fullName}`;

  const existing = await prisma.repository.findUnique({
    where: { workspaceId_fullName: { workspaceId, fullName } },
  });
  if (existing) throw new Error("Repository is already connected to this workspace");

  const repo = await prisma.repository.create({
    data: {
      workspaceId,
      fullName,
      description: description ?? "",
      githubUrl,
      status: "Connected",
      lastSyncedAt: new Date(),
    },
  });

  return formatRepository(repo);
}

export async function syncRepository(
  workspaceId: string,
  repositoryId: string,
  userId?: string
): Promise<{ message: string; repository: FormattedRepository }> {
  const repo = await prisma.repository.findFirst({
    where: { id: repositoryId, workspaceId },
  });
  if (!repo) throw new Error("Repository not found");

  let realCommitCount = repo.commitsAnalyzed;
  let realBugFixesCount = repo.bugFixesDetected;

  // 1. Resolve GitHub access token (from current user or workspace owner)
  let token: string | null = null;
  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { githubAccessToken: true },
    });
    token = user?.githubAccessToken ?? null;
  }

  if (!token) {
    const ownerMember = await prisma.workspaceMember.findFirst({
      where: { workspaceId, role: "OWNER" },
      include: { user: true },
    });
    token = ownerMember?.user?.githubAccessToken ?? null;
  }

  // 2. Fetch real commit history from GitHub API
  try {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "DebugDiary-App",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const ghRes = await fetch(
      `https://api.github.com/repos/${repo.fullName}/commits?per_page=100`,
      { headers }
    );

    if (ghRes.ok) {
      const commits = (await ghRes.json()) as Array<{
        sha: string;
        commit: { message: string };
      }>;

      if (Array.isArray(commits)) {
        realCommitCount = commits.length;

        // Detect real bug fixes from commit messages
        const bugFixes = commits.filter((c) => {
          const msg = c.commit?.message?.toLowerCase() || "";
          return (
            msg.startsWith("fix") ||
            msg.includes("fix:") ||
            msg.includes("bug") ||
            msg.includes("hotfix") ||
            msg.includes("resolve") ||
            msg.includes("patch")
          );
        });
        realBugFixesCount = bugFixes.length;
      }
    }

    // 2b. Fetch Pull Requests from GitHub and auto-draft Incidents for Review Queue
    try {
      const pullsRes = await fetch(
        `https://api.github.com/repos/${repo.fullName}/pulls?state=all&per_page=30`,
        { headers }
      );
      if (pullsRes.ok) {
        const pulls = (await pullsRes.json()) as Array<{
          number: number;
          title: string;
          body?: string | null;
          html_url: string;
          state: string;
          merged_at?: string | null;
          user?: { login: string };
        }>;

        for (const pr of pulls) {
          const existing = await prisma.incident.findFirst({
            where: { workspaceId, pullRequest: `PR #${pr.number}` },
          });
          if (!existing) {
            const text = `${pr.title} ${pr.body || ""}`.toLowerCase();
            let category = "API";
            if (text.includes("auth") || text.includes("login") || text.includes("token")) {
              category = "Authentication";
            } else if (text.includes("db") || text.includes("database") || text.includes("sql") || text.includes("prisma")) {
              category = "Database";
            } else if (text.includes("ui") || text.includes("css") || text.includes("frontend") || text.includes("readme") || text.includes("doc")) {
              category = "Frontend";
            } else if (text.includes("ci") || text.includes("build") || text.includes("deploy") || text.includes("docker")) {
              category = "CI/CD";
            } else if (text.includes("infra") || text.includes("server")) {
              category = "Infrastructure";
            }

            await prisma.incident.create({
              data: {
                workspaceId,
                repositoryId: repo.id,
                title: pr.title,
                category,
                symptom: `Pull request #${pr.number} created by @${pr.user?.login || "contributor"} (${pr.state})`,
                rootCause: pr.body?.trim() || `Changes proposed in Pull Request #${pr.number}: ${pr.title}`,
                resolution: pr.merged_at
                  ? `Fix verified and merged into default branch (${pr.html_url})`
                  : `Tracked in Pull Request: ${pr.html_url}`,
                status: "pending_review",
                confidenceScore: 0.85,
                pullRequest: `PR #${pr.number}`,
                githubUrl: pr.html_url,
                tags: ["github-pr", category.toLowerCase(), pr.state],
              },
            });
          }
        }
      }
    } catch (prErr) {
      console.warn("Could not fetch pulls from GitHub API for:", repo.fullName, prErr);
    }
  } catch (err) {
    console.warn("Could not fetch commits from GitHub API for:", repo.fullName, err);
  }

  // 3. Persist exact commit and bug fix count (commits + PR incidents)
  const incidentCount = await prisma.incident.count({
    where: { repositoryId },
  });
  const finalBugFixesCount = Math.max(realBugFixesCount, incidentCount);

  const updated = await prisma.repository.update({
    where: { id: repositoryId },
    data: {
      lastSyncedAt: new Date(),
      commitsAnalyzed: realCommitCount,
      bugFixesDetected: finalBugFixesCount,
    },
  });

  return {
    message: "Repository sync completed successfully",
    repository: formatRepository(updated),
  };
}

// ─── Disconnect Repository ────────────────────────────────────────────────────

export async function disconnectRepository(
  workspaceId: string,
  repositoryId: string
): Promise<FormattedRepository> {
  const repo = await prisma.repository.findFirst({
    where: { id: repositoryId, workspaceId },
  });
  if (!repo) throw new Error("Repository not found");

  const updated = await prisma.repository.update({
    where: { id: repositoryId },
    data: { status: "Disconnected" },
  });

  return formatRepository(updated);
}

// ─── Reconnect Repository ─────────────────────────────────────────────────────

export async function reconnectRepository(
  workspaceId: string,
  repositoryId: string
): Promise<FormattedRepository> {
  const repo = await prisma.repository.findFirst({
    where: { id: repositoryId, workspaceId },
  });
  if (!repo) throw new Error("Repository not found");

  const updated = await prisma.repository.update({
    where: { id: repositoryId },
    data: { status: "Connected", lastSyncedAt: new Date() },
  });

  return formatRepository(updated);
}

// ─── Delete Repository ────────────────────────────────────────────────────────

export async function deleteRepository(
  workspaceId: string,
  repositoryId: string
): Promise<{ message: string }> {
  const repo = await prisma.repository.findFirst({
    where: { id: repositoryId, workspaceId },
  });
  if (!repo) throw new Error("Repository not found");

  await prisma.repository.delete({
    where: { id: repositoryId },
  });

  return { message: "Repository removed successfully" };
}

// ─── Format Helper ────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function formatRepository(repo: any): FormattedRepository {
  return {
    id: repo.id,
    name: repo.fullName,
    description: repo.description,
    status: repo.status,
    lastSynced: formatRelativeTime(repo.lastSyncedAt),
    commitsAnalyzed: formatNumber(repo.commitsAnalyzed),
    bugFixesDetected: formatNumber(repo.bugFixesDetected),
    githubUrl: repo.githubUrl,
  };
}

// ─── URL Parser ───────────────────────────────────────────────────────────────

function extractRepoFullName(url: string): string {
  const cleaned = url
    .trim()
    .replace(/https?:\/\/github\.com\//, "")
    .replace(/\.git$/, "")
    .replace(/\/$/, "");

  const parts = cleaned.split("/").filter(Boolean);
  if (parts.length < 2) {
    throw new Error(
      'Invalid GitHub URL. Expected format: https://github.com/owner/repository'
    );
  }
  return `${parts[0]}/${parts[1]}`;
}
