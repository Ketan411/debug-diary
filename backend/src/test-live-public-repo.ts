import { isRelevantCommit } from "./services/relevance.service";
import { redactSecrets } from "./services/security.service";
import { extractIncidentFromCommit } from "./services/ai.service";
import { generateEmbedding, cosineSimilarity } from "./services/embedding.service";

async function testPublicRepoPipeline(repoFullName = "axios/axios") {
  console.log("================================================================================");
  console.log(`🌐 Testing DebugDiary Pipeline on Live Public GitHub Repository: ${repoFullName}`);
  console.log("================================================================================\n");

  console.log(`1. Fetching recent commit history from https://api.github.com/repos/${repoFullName}/commits...`);

  const ghRes = await fetch(`https://api.github.com/repos/${repoFullName}/commits?per_page=15`, {
    headers: {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "DebugDiary-Verification-Agent",
    },
  });

  if (!ghRes.ok) {
    throw new Error(`GitHub API returned HTTP ${ghRes.status}: ${ghRes.statusText}`);
  }

  const commits = (await ghRes.json()) as Array<{
    sha: string;
    html_url: string;
    commit: {
      message: string;
      author?: { name: string; date: string };
    };
  }>;

  console.log(`   Fetched ${commits.length} commits successfully!\n`);

  const extractedIncidents: Array<{
    sha: string;
    title: string;
    category: string;
    symptom: string;
    rootCause: string;
    resolution: string;
    tags: string[];
    vector: number[];
  }> = [];

  let relevantCount = 0;
  let trivialCount = 0;

  for (let i = 0; i < commits.length; i++) {
    const c = commits[i];
    const rawMsg = c.commit.message;
    const shortSha = c.sha.slice(0, 7);
    const firstLine = rawMsg.split("\n")[0].slice(0, 75);

    // Step A: Relevance Scoring
    const relevance = isRelevantCommit(rawMsg);

    if (relevance.isRelevant) {
      relevantCount++;
      console.log(`--------------------------------------------------------------------------------`);
      console.log(`🔍 [RELEVANT COMMIT #${relevantCount}] ${shortSha}: "${firstLine}" (Score: ${relevance.score})`);

      // Step B: Sensitive Data Redaction
      const sanitizedMsg = redactSecrets(rawMsg);

      // Step C: Open-Source AI Extraction Engine
      const incident = await extractIncidentFromCommit({
        commitMessage: sanitizedMsg,
        repoName: repoFullName,
        commitSha: c.sha,
        htmlUrl: c.html_url,
      });

      console.log(`   📌 Extracted Title:    ${incident.title}`);
      console.log(`   🏷️  Category:           ${incident.category}`);
      console.log(`   ⚠️  Symptom:            ${incident.symptom.slice(0, 90)}...`);
      console.log(`   🎯 Root Cause:         ${incident.rootCause.slice(0, 90)}...`);
      console.log(`   💡 Resolution:         ${incident.resolution.slice(0, 90)}...`);
      console.log(`   🏷️  Tags:               [${incident.tags.join(", ")}]`);
      console.log(`   ⭐ Confidence Score:   ${Math.round(incident.confidenceScore * 100)}%`);

      // Step D: Vector Embedding
      const textToEmbed = `${incident.title}. Symptom: ${incident.symptom}. Root Cause: ${incident.rootCause}. Fix: ${incident.resolution}. Tags: ${incident.tags.join(" ")}`;
      const vector = await generateEmbedding(textToEmbed);

      extractedIncidents.push({
        sha: shortSha,
        title: incident.title,
        category: incident.category,
        symptom: incident.symptom,
        rootCause: incident.rootCause,
        resolution: incident.resolution,
        tags: incident.tags,
        vector,
      });
    } else {
      trivialCount++;
      console.log(`⏭️  [SKIPPED CHORE/DOCS] ${shortSha}: "${firstLine}" (Score: ${relevance.score})`);
    }
  }

  console.log("\n================================================================================");
  console.log(`📊 Ingestion Summary for ${repoFullName}:`);
  console.log(`   Total Commits Analyzed:  ${commits.length}`);
  console.log(`   Bug Fixes Detected:      ${relevantCount}`);
  console.log(`   Chores/Docs Filtered:    ${trivialCount}`);
  console.log("================================================================================\n");

  if (extractedIncidents.length > 0) {
    // Step E: Test Hybrid Search & Semantic Matching against Extracted Incidents
    console.log("🧪 Testing Semantic Hybrid Search across Extracted Public Repo Incidents:");
    const testQuery = "network timeout error handling and request retry";
    console.log(`   User Search Query: "${testQuery}"\n`);

    const queryVector = await generateEmbedding(testQuery);

    const scored = extractedIncidents.map((inc) => {
      const cosine = cosineSimilarity(queryVector, inc.vector);
      const matchPercentage = Math.round(cosine * 100);
      return {
        title: inc.title,
        category: inc.category,
        sha: inc.sha,
        similarity: matchPercentage,
      };
    }).sort((a, b) => b.similarity - a.similarity);

    console.log("   Ranked Hybrid Results:");
    scored.forEach((r, idx) => {
      console.log(`   ${idx + 1}. [${r.similarity}% Match] [${r.category}] ${r.title} (Commit: ${r.sha})`);
    });
  }
}

// Run test on axios/axios
testPublicRepoPipeline("axios/axios").catch((err) => {
  console.error("Pipeline test failed:", err);
  process.exit(1);
});
