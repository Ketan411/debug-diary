import { prisma } from "../db/prisma";
import { formatRelativeTime, formatNumber } from "../utils/format";
import { isRelevantCommit } from "./relevance.service";
import { redactSecrets } from "./security.service";
import { extractIncidentFromCommit } from "./ai.service";

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

  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "DebugDiary-App",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  // 2. Fetch real commit history from GitHub REST API
  try {
    const ghRes = await fetch(
      `https://api.github.com/repos/${repo.fullName}/commits?per_page=50`,
      { headers }
    );

    if (ghRes.ok) {
      const commits = (await ghRes.json()) as Array<{
        sha: string;
        html_url?: string;
        commit: { message: string };
      }>;

      if (Array.isArray(commits)) {
        realCommitCount = commits.length;

        for (const c of commits) {
          const rawMsg = c.commit?.message || "";
          
          // A. Relevance Check
          const relevance = isRelevantCommit(rawMsg);

          if (relevance.isRelevant) {
            // B. Sensitive Data Redaction Engine
            const sanitizedMsg = redactSecrets(rawMsg);

            // Check if incident already drafted for this commit
            const shortSha = c.sha.slice(0, 7);
            const existingIncident = await prisma.incident.findFirst({
              where: { workspaceId, commitSha: shortSha },
            });

            if (!existingIncident) {
              // C. Open-Source LLM AI Extraction Pipeline
              const extracted = await extractIncidentFromCommit({
                commitMessage: sanitizedMsg,
                repoName: repo.fullName,
                commitSha: c.sha,
                htmlUrl: c.html_url ?? `https://github.com/${repo.fullName}/commit/${c.sha}`,
              });

              await prisma.incident.create({
                data: {
                  workspaceId,
                  repositoryId: repo.id,
                  title: extracted.title,
                  category: extracted.category,
                  symptom: extracted.symptom,
                  rootCause: extracted.rootCause,
                  resolution: extracted.resolution,
                  status: "pending_review",
                  confidenceScore: extracted.confidenceScore,
                  commitSha: shortSha,
                  commitMessage: sanitizedMsg,
                  githubUrl: c.html_url ?? `https://github.com/${repo.fullName}/commit/${c.sha}`,
                  affectedFiles: extracted.affectedFiles,
                  tags: extracted.tags,
                },
              });
              realBugFixesCount++;
            }
          }
        }
      }
    }

    // 2b. Fetch Pull Requests from GitHub and draft Incidents
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
            const fullPRText = `${pr.title} ${pr.body || ""}`;
            const relevance = isRelevantCommit(fullPRText);

            if (relevance.isRelevant) {
              const sanitizedTitle = redactSecrets(pr.title);
              const sanitizedBody = redactSecrets(pr.body || "");

              const extracted = await extractIncidentFromCommit({
                commitMessage: sanitizedTitle,
                diff: sanitizedBody,
                repoName: repo.fullName,
                pullRequest: `PR #${pr.number}`,
                htmlUrl: pr.html_url,
              });

              await prisma.incident.create({
                data: {
                  workspaceId,
                  repositoryId: repo.id,
                  title: extracted.title,
                  category: extracted.category,
                  symptom: extracted.symptom,
                  rootCause: extracted.rootCause,
                  resolution: pr.merged_at
                    ? `Merged into default branch: ${extracted.resolution}`
                    : extracted.resolution,
                  status: "pending_review",
                  confidenceScore: extracted.confidenceScore,
                  pullRequest: `PR #${pr.number}`,
                  githubUrl: pr.html_url,
                  affectedFiles: extracted.affectedFiles,
                  tags: Array.from(new Set([...extracted.tags, "github-pr"])),
                },
              });
              realBugFixesCount++;
            }
          }
        }
      }
    } catch (prErr) {
      console.warn("Could not fetch pulls from GitHub API for:", repo.fullName, prErr);
    }
  } catch (err) {
    console.warn("Could not fetch commits from GitHub API for:", repo.fullName, err);
  }

  // 3. Persist exact commit and bug fix count
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
