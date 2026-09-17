import { prisma } from "./db/prisma";
import { handleWebhookEvent } from "./services/webhook.service";
import { getReviewQueue } from "./services/incident.service";

async function testFullWebhookFlow() {
  console.log("=================================================");
  console.log("🚀 Simulating End-to-End GitHub Webhook & AI Flow");
  console.log("=================================================\n");

  // 1. Ensure test Workspace & Repository exist
  let workspace = await prisma.workspace.findFirst({
    where: { name: "DebugDiary Test Team" },
  });

  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: { name: "DebugDiary Test Team" },
    });
  }

  let repo = await prisma.repository.findFirst({
    where: { workspaceId: workspace.id, fullName: "acme/payment-service" },
  });

  if (!repo) {
    repo = await prisma.repository.create({
      data: {
        workspaceId: workspace.id,
        fullName: "acme/payment-service",
        githubUrl: "https://github.com/acme/payment-service",
        status: "Connected",
      },
    });
  }

  console.log(`✅ Test Workspace ID: ${workspace.id}`);
  console.log(`✅ Connected Repository: ${repo.fullName}`);

  // 2. Construct simulated GitHub Webhook Push Payload containing a Bug Fix & Raw Secret
  const deliveryId = `test-delivery-${Date.now()}`;
  const pushPayload = {
    repository: { full_name: "acme/payment-service" },
    commits: [
      {
        id: "b7c9e1f2a3456789",
        message: "fix: resolved Axios 401 token expiration retry loop\n\nFixed API auth header renewal. Temp key used during test: sk-proj-1234567890abcdef1234567890 and DB postgres://admin:SecretPass123@localhost:5432/db",
        url: "https://github.com/acme/payment-service/commit/b7c9e1f2a3456789",
        added: [],
        modified: ["src/api/client.ts", "src/auth/tokenManager.ts"],
        removed: [],
      },
    ],
  };

  console.log("\n📩 Dispatching simulated GitHub Push Webhook...");
  const webhookResult = await handleWebhookEvent("push", deliveryId, pushPayload);
  console.log("Webhook Processing Result:", webhookResult);

  // 3. Fetch the Review Queue to inspect the AI-extracted, Redacted Incident Card
  console.log("\n📋 Inspecting Incident Review Queue...");
  const queue = await getReviewQueue(workspace.id);

  console.log(`Total Pending Incidents in Review Queue: ${queue.total}`);
  const latestIncident = queue.incidents[queue.incidents.length - 1];

  if (latestIncident) {
    console.log("\n✨ AI-Extracted & Redacted Incident Draft:");
    console.log("-----------------------------------------");
    console.log(`📌 ID:            ${latestIncident.id}`);
    console.log(`📌 Title:         ${latestIncident.title}`);
    console.log(`📌 Category:      ${latestIncident.category}`);
    console.log(`📌 Confidence:    ${latestIncident.confidence}%`);
    console.log(`📌 Symptom:       ${latestIncident.symptom}`);
    console.log(`📌 Root Cause:    ${latestIncident.rootCause}`);
    console.log(`📌 Resolution:    ${latestIncident.resolution}`);
    console.log(`📌 Affected Files:${latestIncident.affectedFiles.join(", ")}`);
    console.log(`📌 Commit Message (Scrubbed):\n   "${latestIncident.commitMessage}"`);

    // Verify secrets were scrubbed
    const wasScrubbed =
      !latestIncident.commitMessage.includes("SecretPass123") &&
      !latestIncident.commitMessage.includes("sk-proj-1234567890abcdef1234567890");

    if (wasScrubbed) {
      console.log("\n🔒 SECURITY CHECK PASSED: All secrets scrubbed before storing!");
    } else {
      console.log("\n❌ SECURITY CHECK FAILED: Secret key survived!");
    }
  }

  console.log("\n=================================================");
  console.log("🎉 Full Webhook & AI Pipeline Simulation Completed!");
  console.log("=================================================");
}

testFullWebhookFlow()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
  });
