import crypto from "crypto";
import { env } from "../config/env";
import { prisma } from "../db/prisma";

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
  let createdIncidentId: string | null = null;

  if (repoFullName) {
    const repos = await prisma.repository.findMany({
      where: { fullName: { equals: repoFullName, mode: "insensitive" } },
    });
    matchedReposCount = repos.length;

    // ─── A. Push Event Handler ───────────────────────────────────────────────
    if (eventType === "push" && repos.length > 0) {
      const rawCommits = (payload as { commits?: Array<{ message?: string }> })?.commits;
      const commitCount = Array.isArray(rawCommits) ? rawCommits.length : 1;

      let bugFixCount = 0;
      if (Array.isArray(rawCommits)) {
        bugFixCount = rawCommits.filter((c) => {
          const msg = (c?.message || "").toLowerCase();
          return (
            msg.startsWith("fix") ||
            msg.includes("fix:") ||
            msg.includes("bug") ||
            msg.includes("hotfix") ||
            msg.includes("resolve") ||
            msg.includes("patch")
          );
        }).length;
      }

      for (const repo of repos) {
        await prisma.repository.update({
          where: { id: repo.id },
          data: {
            lastSyncedAt: new Date(),
            commitsAnalyzed: { increment: commitCount },
            ...(bugFixCount > 0 ? { bugFixesDetected: { increment: bugFixCount } } : {}),
          },
        });
      }
    }

    // ─── B. Pull Request Event Handler ───────────────────────────────────────
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
        for (const repo of repos) {
          // Categorize based on keywords in title/body
          const text = `${pr.title} ${pr.body || ""}`.toLowerCase();
          let category = "API";
          if (text.includes("auth") || text.includes("token") || text.includes("login") || text.includes("jwt")) {
            category = "Authentication";
          } else if (text.includes("db") || text.includes("database") || text.includes("sql") || text.includes("prisma")) {
            category = "Database";
          } else if (text.includes("ui") || text.includes("css") || text.includes("frontend") || text.includes("component")) {
            category = "Frontend";
          } else if (text.includes("ci") || text.includes("build") || text.includes("deploy") || text.includes("docker")) {
            category = "CI/CD";
          } else if (text.includes("infra") || text.includes("server") || text.includes("nginx")) {
            category = "Infrastructure";
          }

          // Check if incident already exists for this PR
          const existingIncident = await prisma.incident.findFirst({
            where: { workspaceId: repo.workspaceId, pullRequest: `PR #${pr.number}` },
          });

          if (!existingIncident) {
            const isMerged = pr.merged === true;
            const newIncident = await prisma.incident.create({
              data: {
                workspaceId: repo.workspaceId,
                repositoryId: repo.id,
                title: pr.title,
                category,
                symptom: `Pull request #${pr.number} created by @${pr.user?.login || "contributor"}`,
                rootCause: pr.body?.trim() || `Proposed fix in pull request #${pr.number}: ${pr.title}`,
                resolution: isMerged
                  ? `Fix verified and merged into default branch (${pr.html_url})`
                  : `Under review in Pull Request: ${pr.html_url}`,
                status: "pending_review",
                confidenceScore: 0.85,
                pullRequest: `PR #${pr.number}`,
                githubUrl: pr.html_url,
                tags: ["github-pr", category.toLowerCase(), action || "pr"],
              },
            });
            createdIncidentId = newIncident.id;

            // Increment bugFixesDetected if PR is a bug fix or merged
            const isBugFix =
              isMerged ||
              text.includes("fix") ||
              text.includes("bug") ||
              text.includes("resolve") ||
              text.includes("patch");

            if (isBugFix) {
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
        for (const repo of repos) {
          await prisma.incident.create({
            data: {
              workspaceId: repo.workspaceId,
              repositoryId: repo.id,
              title: issue.title,
              category: "API",
              symptom: issue.body?.trim() || `Issue #${issue.number} reported by @${issue.user?.login || "user"}`,
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
  };
}
