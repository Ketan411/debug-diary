import crypto from "crypto";
import { env } from "../config/env";
import { prisma } from "../db/prisma";
import { redactSecrets } from "./security.service";
import { isRelevantCommit } from "./relevance.service";
import { extractIncidentFromCommit } from "./ai.service";

// ─── HMAC Signature Verification ─────────────────────────────────────────────

export function verifyGitHubSignature(
  rawBody: Buffer,
  signature: string
): boolean {
  if (!env.GITHUB_WEBHOOK_SECRET) {
    // If no secret configured, skip verification (dev mode)
    return true;
  }

  const expected = `sha256=${crypto
    .createHmac("sha256", env.GITHUB_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex")}`;

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(signature)
    );
  } catch {
    return false;
  }
}

// ─── Store & Route Webhook Event ─────────────────────────────────────────────

export async function handleWebhookEvent(
  eventType: string,
  deliveryId: string,
  payload: unknown
) {
  // 1. Idempotency — skip if already processed
  const existing = await prisma.rawWebhookEvent.findUnique({
    where: { deliveryId },
  });
  if (existing) {
    return { message: "Duplicate event — already processed", skipped: true };
  }

  // 2. Persist raw event audit trail
  const rawEvent = await prisma.rawWebhookEvent.create({
    data: {
      deliveryId,
      eventType,
      payload: payload as object,
      processed: false,
    },
  });

  // 3. Handle GitHub Webhook Ping
  if (eventType === "ping") {
    await prisma.rawWebhookEvent.update({
      where: { id: rawEvent.id },
      data: { processed: true },
    });
    return {
      message: "Pong! GitHub webhook verified successfully.",
      skipped: false,
      zen: (payload as { zen?: string })?.zen,
    };
  }

  // 4. Route and Process Events for Connected Repositories
  const repoFullName = (payload as { repository?: { full_name?: string } })
    ?.repository?.full_name;

  let matchedReposCount = 0;
  let createdIncidentIds: string[] = [];

  if (repoFullName) {
    const repos = await prisma.repository.findMany({
      where: { fullName: { equals: repoFullName, mode: "insensitive" } },
    });
    matchedReposCount = repos.length;

    // ─── A. Push Event Handler with Open-Source AI Extraction Pipeline ───────
    if (eventType === "push" && repos.length > 0) {
      const pushPayload = payload as {
        commits?: Array<{
          id?: string;
          message?: string;
          url?: string;
          added?: string[];
          modified?: string[];
          removed?: string[];
        }>;
      };

      const rawCommits = pushPayload.commits ?? [];
      const commitCount = rawCommits.length;

      for (const commit of rawCommits) {
        const commitMsg = commit.message || "";
        const modifiedFiles = [
          ...(commit.added || []),
          ...(commit.modified || []),
          ...(commit.removed || []),
        ];

        // 1. Relevance Filter Check
        const relevance = isRelevantCommit(commitMsg, undefined, modifiedFiles);

        if (relevance.isRelevant) {
          // 2. Sensitive Data Redaction Engine
          const sanitizedMsg = redactSecrets(commitMsg);

          // 3. Open-Source LLM Extraction Pipeline
          const extracted = await extractIncidentFromCommit({
            commitMessage: sanitizedMsg,
            repoName: repoFullName,
            commitSha: commit.id,
            htmlUrl: commit.url,
            modifiedFiles,
          });

          // 4. Save Incident Draft into database for each connected workspace
          for (const repo of repos) {
            const incident = await prisma.incident.create({
              data: {
                workspaceId: repo.workspaceId,
                repositoryId: repo.id,
                title: extracted.title,
                category: extracted.category,
                symptom: extracted.symptom,
                rootCause: extracted.rootCause,
                resolution: extracted.resolution,
                status: "pending_review",
                confidenceScore: extracted.confidenceScore,
                commitSha: commit.id ? commit.id.slice(0, 7) : null,
                commitMessage: sanitizedMsg,
                githubUrl: commit.url ?? repo.githubUrl,
                affectedFiles: extracted.affectedFiles,
                tags: extracted.tags,
              },
            });
            createdIncidentIds.push(incident.id);
          }
        }
      }

      for (const repo of repos) {
        await prisma.repository.update({
          where: { id: repo.id },
          data: {
            lastSyncedAt: new Date(),
            commitsAnalyzed: { increment: commitCount },
            ...(createdIncidentIds.length > 0
              ? { bugFixesDetected: { increment: createdIncidentIds.length } }
              : {}),
          },
        });
      }
    }

    // ─── B. Pull Request Event Handler with AI Extraction Pipeline ───────────
    if (eventType === "pull_request" && repos.length > 0) {
      const prPayload = payload as {
        action?: string;
        pull_request?: {
          number: number;
          title: string;
          body?: string | null;
          html_url: string;
          merged?: boolean;
          user?: { login: string };
        };
      };

      const pr = prPayload.pull_request;
      const action = prPayload.action;

      if (pr && (action === "opened" || action === "closed" || action === "reopened")) {
        const fullPRText = `${pr.title} ${pr.body || ""}`;

        // 1. Relevance Check
        const relevance = isRelevantCommit(fullPRText);

        if (relevance.isRelevant) {
          // 2. Sensitive Data Redaction Engine
          const sanitizedPRText = redactSecrets(fullPRText);

          // 3. Open-Source LLM Extraction Pipeline
          const extracted = await extractIncidentFromCommit({
            commitMessage: redactSecrets(pr.title),
            diff: redactSecrets(pr.body || ""),
            repoName: repoFullName,
            pullRequest: `PR #${pr.number}`,
            htmlUrl: pr.html_url,
          });

          for (const repo of repos) {
            const existingIncident = await prisma.incident.findFirst({
              where: { workspaceId: repo.workspaceId, pullRequest: `PR #${pr.number}` },
            });

            if (!existingIncident) {
              const newIncident = await prisma.incident.create({
                data: {
                  workspaceId: repo.workspaceId,
                  repositoryId: repo.id,
                  title: extracted.title,
                  category: extracted.category,
                  symptom: extracted.symptom,
                  rootCause: extracted.rootCause,
                  resolution: pr.merged
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
              createdIncidentIds.push(newIncident.id);

              await prisma.repository.update({
                where: { id: repo.id },
                data: {
                  lastSyncedAt: new Date(),
                  bugFixesDetected: { increment: 1 },
                },
              });
            }
          }
        }
      }
    }

    // ─── C. Issues Event Handler ─────────────────────────────────────────────
    if (eventType === "issues" && repos.length > 0) {
      const issuePayload = payload as {
        action?: string;
        issue?: {
          number: number;
          title: string;
          body?: string | null;
          html_url: string;
          state: string;
          user?: { login: string };
          labels?: Array<{ name: string }>;
        };
      };

      const issue = issuePayload.issue;
      const action = issuePayload.action;

      if (issue && action === "opened") {
        const sanitizedBody = redactSecrets(issue.body || "");
        const sanitizedTitle = redactSecrets(issue.title);

        for (const repo of repos) {
          await prisma.incident.create({
            data: {
              workspaceId: repo.workspaceId,
              repositoryId: repo.id,
              title: sanitizedTitle,
              category: "API",
              symptom: sanitizedBody || `Issue #${issue.number} reported by @${issue.user?.login || "user"}`,
              rootCause: "Under investigation (GitHub Issue)",
              resolution: `Tracked in GitHub Issue #${issue.number}: ${issue.html_url}`,
              status: "pending_review",
              confidenceScore: 0.7,
              githubUrl: issue.html_url,
              tags: ["github-issue", ...(issue.labels?.map((l) => l.name.toLowerCase()) || [])],
            },
          });
        }
      }
    }
  }

  // 5. Mark as processed
  await prisma.rawWebhookEvent.update({
    where: { id: rawEvent.id },
    data: { processed: true },
  });

  return {
    message: `Webhook received and processed for ${eventType}`,
    skipped: false,
    eventType,
    deliveryId,
    repository: repoFullName ?? null,
    syncedWorkspaces: matchedReposCount,
    createdIncidentsCount: createdIncidentIds.length,
  };
}
