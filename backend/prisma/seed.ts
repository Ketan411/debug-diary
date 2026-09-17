/**
 * prisma/seed.ts — Populates the database with realistic demo data
 * Run with: npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { subMonths, subDays, subHours } from "date-fns";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...\n");

  // ─── Demo User ──────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash("password123", 12);

  const user = await prisma.user.upsert({
    where: { email: "demo@debugdiary.com" },
    update: { name: "Manika Singh", passwordHash },
    create: {
      email: "demo@debugdiary.com",
      passwordHash,
      name: "Manika Singh",
    },
  });
  console.log(`✅ User: ${user.email}`);

  // ─── Workspace ──────────────────────────────────────────────────────────────
  let workspace = await prisma.workspace.findFirst({
    where: { members: { some: { userId: user.id } } },
  });

  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: {
        name: "Acme Engineering",
        members: { create: { userId: user.id, role: "OWNER" } },
      },
    });
  }
  console.log(`✅ Workspace: ${workspace.name}`);

  // ─── Repositories ───────────────────────────────────────────────────────────
  const webApp = await prisma.repository.upsert({
    where: {
      workspaceId_fullName: { workspaceId: workspace.id, fullName: "acme/web-app" },
    },
    update: {},
    create: {
      workspaceId: workspace.id,
      fullName: "acme/web-app",
      description: "Main customer-facing web application",
      githubUrl: "https://github.com/acme/web-app",
      status: "Connected",
      lastSyncedAt: subHours(new Date(), 2),
      commitsAnalyzed: 1248,
      bugFixesDetected: 86,
    },
  });

  const backendApi = await prisma.repository.upsert({
    where: {
      workspaceId_fullName: { workspaceId: workspace.id, fullName: "acme/backend-api" },
    },
    update: {},
    create: {
      workspaceId: workspace.id,
      fullName: "acme/backend-api",
      description: "Backend services and REST APIs",
      githubUrl: "https://github.com/acme/backend-api",
      status: "Connected",
      lastSyncedAt: subDays(new Date(), 1),
      commitsAnalyzed: 542,
      bugFixesDetected: 31,
    },
  });
  console.log(`✅ Repositories: ${webApp.fullName}, ${backendApi.fullName}`);

  // ─── Incidents ──────────────────────────────────────────────────────────────
  // Clear existing incidents so seed is idempotent
  await prisma.incident.deleteMany({ where: { workspaceId: workspace.id } });

  const incidents = [
    // ── Verified incidents (spread across months for trend chart) ──
    {
      title: "JWT Refresh Retry Loop",
      category: "Authentication",
      tags: ["JWT", "Axios", "Authentication"],
      symptom: "Users were repeatedly redirected to the login page after their access token expired, even after the token refresh succeeded.",
      rootCause: "The Axios interceptor was not attaching the newly refreshed token to the retried request. It was still sending the expired token on retry.",
      resolution: "Attach the refreshed access token to the original failed request config before retrying. Add a flag to prevent infinite retry loops.",
      status: "verified",
      confidenceScore: 0.94,
      repositoryId: webApp.id,
      commitMessage: "fix: attach refreshed token to retry request in interceptor",
      commitSha: "a8f3c21d4e5",
      pullRequest: "PR #48",
      githubUrl: "https://github.com/acme/web-app/pull/48",
      affectedFiles: ["src/api/interceptor.ts", "src/services/auth.ts"],
      verifiedById: user.id,
      verifiedAt: subDays(new Date(), 2),
      createdAt: subDays(new Date(), 2),
    },
    {
      title: "Database Connection Pool Exhaustion",
      category: "Database",
      tags: ["PostgreSQL", "Connection Pool", "Performance"],
      symptom: "API requests intermittently returned 500 errors during high traffic. Logs showed 'connection pool exhausted' errors.",
      rootCause: "Database connections were not being released after transactions. A missing try-finally block left connections open on error paths.",
      resolution: "Wrap all DB calls in try-finally to guarantee connection release. Increase pool size and add pool health monitoring.",
      status: "verified",
      confidenceScore: 0.88,
      repositoryId: backendApi.id,
      commitMessage: "fix: release db connections in finally block to prevent pool leak",
      commitSha: "b7d9f4e12a",
      pullRequest: "PR #72",
      githubUrl: "https://github.com/acme/backend-api/pull/72",
      affectedFiles: ["src/db/pool.ts", "src/middleware/db.ts"],
      verifiedById: user.id,
      verifiedAt: subHours(new Date(), 6),
      createdAt: subHours(new Date(), 6),
    },
    {
      title: "Payment API Request Timeout",
      category: "API",
      tags: ["Payments", "REST API", "Timeout", "Retry"],
      symptom: "Payment requests silently timed out after 30 seconds with no user-facing error message. Stripe webhook confirmations were also missed.",
      rootCause: "The Stripe client was initialized without a timeout config, defaulting to the OS TCP timeout (120s). No retry policy was set.",
      resolution: "Configure the Stripe client with a 15s timeout and 2-retry policy. Add a circuit breaker to fast-fail when the payment gateway is down.",
      status: "verified",
      confidenceScore: 0.91,
      repositoryId: backendApi.id,
      commitMessage: "fix: add timeout and retry logic to Stripe payment client",
      commitSha: "c3e8a12f7b",
      pullRequest: "PR #91",
      githubUrl: "https://github.com/acme/backend-api/pull/91",
      affectedFiles: ["src/services/payment.ts", "src/config/stripe.ts"],
      verifiedById: user.id,
      verifiedAt: subDays(new Date(), 3),
      createdAt: subMonths(new Date(), 1),
    },
    {
      title: "Session Cookie/JWT Expiry Mismatch",
      category: "Authentication",
      tags: ["Session", "JWT", "Cookie", "Auth"],
      symptom: "Users were unexpectedly logged out mid-session even though their JWT token was still valid. The logout was triggered by the session cookie expiring first.",
      rootCause: "The session cookie maxAge was set to 1 hour while the JWT expiry was set to 7 days. The cookie expired first, destroying the session.",
      resolution: "Align session cookie maxAge with JWT expiry. Implement silent token refresh 5 minutes before expiry using a background timer.",
      status: "verified",
      confidenceScore: 0.81,
      repositoryId: webApp.id,
      commitMessage: "fix: sync session cookie expiry with JWT token lifetime",
      commitSha: "d5f2b93e1c",
      pullRequest: "PR #52",
      githubUrl: "https://github.com/acme/web-app/pull/52",
      affectedFiles: ["src/auth/session.ts", "src/config/auth.ts"],
      verifiedById: user.id,
      verifiedAt: subDays(new Date(), 5),
      createdAt: subMonths(new Date(), 2),
    },
    {
      title: "Token Signing Key Rotation Failure",
      category: "Authentication",
      tags: ["JWT", "Security", "Key Rotation", "API"],
      symptom: "All authenticated API requests returned 401 after a scheduled security key rotation. Users were completely locked out.",
      rootCause: "The validation service was still using the old signing key. Key rotation was applied to the auth service but not propagated to the validation microservice.",
      resolution: "Implement key ID (kid) in JWT headers. Support multiple active keys during rotation. Add deployment verification tests for key sync.",
      status: "verified",
      confidenceScore: 0.87,
      repositoryId: backendApi.id,
      commitMessage: "fix: support multi-key JWT validation during key rotation",
      commitSha: "e9c4f71d2a",
      pullRequest: "PR #108",
      githubUrl: "https://github.com/acme/backend-api/pull/108",
      affectedFiles: ["src/auth/validate.ts", "src/auth/keys.ts"],
      verifiedById: user.id,
      verifiedAt: subDays(new Date(), 7),
      createdAt: subMonths(new Date(), 3),
    },
    {
      title: "React useEffect Memory Leak",
      category: "Frontend",
      tags: ["React", "useEffect", "Memory Leak", "Async"],
      symptom: "Browser memory usage grew unbounded over time. Users on slow connections experienced tab crashes after 10+ minutes of use.",
      rootCause: "Async fetch calls inside useEffect were updating state after the component unmounted. No cleanup function was returned from the effect.",
      resolution: "Return a cleanup function from useEffect that sets an isMounted flag to false, preventing state updates after unmount. Cancel pending requests with AbortController.",
      status: "verified",
      confidenceScore: 0.79,
      repositoryId: webApp.id,
      commitMessage: "fix: cancel async operations on component unmount to prevent memory leak",
      commitSha: "f1a3c52b8d",
      pullRequest: "PR #103",
      githubUrl: "https://github.com/acme/web-app/pull/103",
      affectedFiles: ["src/hooks/useDataFetch.ts", "src/components/DataTable.tsx"],
      verifiedById: user.id,
      verifiedAt: subMonths(new Date(), 1),
      createdAt: subMonths(new Date(), 4),
    },
    // ── Pending Review incidents ──
    {
      title: "CI Pipeline Missing Environment Variable",
      category: "CI/CD",
      tags: ["GitHub Actions", "Environment", "Testing", "CI"],
      symptom: "CI tests fail consistently even though the same tests pass locally. Error: 'process.env.DATABASE_URL is undefined'.",
      rootCause: "The CI environment was missing the DATABASE_URL secret in the GitHub Actions workflow. It was configured in local .env but not in the repository secrets.",
      resolution: "Add DATABASE_URL and other required variables to GitHub Actions repository secrets. Add a startup validation step that checks for required env vars.",
      status: "pending_review",
      confidenceScore: 0.76,
      repositoryId: webApp.id,
      commitMessage: "fix: add missing DATABASE_URL to CI environment configuration",
      commitSha: "a82f91c3b4",
      pullRequest: null,
      githubUrl: "https://github.com/acme/web-app/commit/a82f91c3b4",
      affectedFiles: [".github/workflows/ci.yml", "src/config/env.ts"],
      createdAt: subDays(new Date(), 1),
    },
    {
      title: "API Rate Limit Not Handled (HTTP 429)",
      category: "API",
      tags: ["Rate Limiting", "HTTP 429", "Error Handling", "Retry"],
      symptom: "Application crashes with an unhandled promise rejection when the third-party payment gateway returns 429 Too Many Requests during peak hours.",
      rootCause: "The HTTP client has no retry-after handling for 429 responses. The error propagates as an unhandled rejection, crashing the worker process.",
      resolution: "Parse the Retry-After response header and implement exponential backoff retry logic (max 3 retries). Add global unhandled rejection handler as safety net.",
      status: "pending_review",
      confidenceScore: 0.89,
      repositoryId: backendApi.id,
      commitMessage: "fix: handle HTTP 429 with exponential backoff retry",
      commitSha: "g7b4d23e91",
      pullRequest: "PR #115",
      githubUrl: "https://github.com/acme/backend-api/pull/115",
      affectedFiles: ["src/services/gateway.ts", "src/utils/retry.ts"],
      createdAt: subHours(new Date(), 8),
    },
  ];

  for (const incidentData of incidents) {
    await prisma.incident.create({
      data: {
        workspaceId: workspace.id,
        ...incidentData,
      },
    });
  }
  console.log(`✅ Incidents: ${incidents.length} created`);

  // ─── Summary ────────────────────────────────────────────────────────────────
  const counts = await Promise.all([
    prisma.user.count(),
    prisma.workspace.count(),
    prisma.repository.count(),
    prisma.incident.count(),
  ]);

  console.log("\n📊 Database summary:");
  console.log(`   Users:        ${counts[0]}`);
  console.log(`   Workspaces:   ${counts[1]}`);
  console.log(`   Repositories: ${counts[2]}`);
  console.log(`   Incidents:    ${counts[3]} (6 verified, 2 pending review)`);
  console.log("\n🔑 Demo credentials:");
  console.log("   Email:    demo@debugdiary.com");
  console.log("   Password: password123");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
