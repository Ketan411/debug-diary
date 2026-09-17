import { redactSecrets, containsSecrets } from "./services/security.service";
import { isRelevantCommit } from "./services/relevance.service";
import { extractIncidentFromCommit } from "./services/ai.service";

async function runPratibhaVerificationTests() {
  console.log("=================================================");
  console.log("🧪 Running Pratibha (AI, Security & Search Lead) Verification Suite");
  console.log("=================================================\n");

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`✅ [PASS] ${testName}`);
    } else {
      console.error(`❌ [FAIL] ${testName} ${detail ? `- ${detail}` : ""}`);
    }
  }

  // -------------------------------------------------------------
  // TEST SUITE 1: Sensitive Data Redaction Engine (Security)
  // -------------------------------------------------------------
  console.log("--- Test Suite 1: Sensitive Data Redaction Engine ---");

  const sampleWithSecrets = `
Fixing auth bug with OpenAI key sk-proj-1234567890abcdef1234567890
Groq Key: gsk_1234567890abcdef1234567890abcdef
DATABASE_URL="postgres://debuguser:SuperSecretPassword123@db.example.com:5432/mydb"
JWT_TOKEN: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
aws_secret_access_key="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
  `;

  assert(containsSecrets(sampleWithSecrets), "Detects presence of secrets in raw text");

  const sanitized = redactSecrets(sampleWithSecrets);
  assert(!sanitized.includes("sk-proj-1234567890abcdef1234567890"), "Redacts OpenAI API Key");
  assert(!sanitized.includes("gsk_1234567890abcdef1234567890abcdef"), "Redacts Groq API Key");
  assert(!sanitized.includes("SuperSecretPassword123"), "Redacts Database Password");
  assert(!sanitized.includes("SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"), "Redacts JWT Signature");
  assert(sanitized.includes("[REDACTED_OPENAI_API_KEY]"), "Includes placeholder [REDACTED_OPENAI_API_KEY]");
  assert(sanitized.includes("[REDACTED_GROQ_API_KEY]"), "Includes placeholder [REDACTED_GROQ_API_KEY]");
  assert(sanitized.includes("[REDACTED_PASSWORD]"), "Includes placeholder [REDACTED_PASSWORD]");

  console.log("\nSample Redacted Output snippet:\n" + sanitized.trim() + "\n");

  // -------------------------------------------------------------
  // TEST SUITE 2: Rule-Based Relevance Filter
  // -------------------------------------------------------------
  console.log("--- Test Suite 2: Rule-Based Relevance Filter ---");

  const bugCommitMsg = "fix: resolved unhandled null pointer exception in JWT token verification";
  const bugResult = isRelevantCommit(bugCommitMsg, "catch (e) { throw new AuthError() }", ["src/auth/jwt.ts", "src/auth/__tests__/jwt.spec.ts"]);
  assert(bugResult.isRelevant, "Identifies bug fix commit as relevant", `Score: ${bugResult.score}`);
  assert(bugResult.score >= 30, "Relevance score >= 30 threshold");

  const trivialCommitMsg = "docs: update README.md typo and formatting";
  const trivialResult = isRelevantCommit(trivialCommitMsg, "", ["README.md"]);
  assert(!trivialResult.isRelevant, "Filters out trivial documentation commit", `Score: ${trivialResult.score}`);
  assert(trivialResult.score < 30, "Trivial score < 30 threshold");

  // -------------------------------------------------------------
  // TEST SUITE 3: Open-Source LLM AI Extraction Pipeline
  // -------------------------------------------------------------
  console.log("\n--- Test Suite 3: Open-Source LLM AI Extraction Pipeline ---");

  const extractionInput = {
    commitMessage: "fix: resolved expired JWT token infinite retry loop in Axios client",
    diff: `
- axios.interceptors.response.use(res => res, err => { return axios.request(err.config); });
+ axios.interceptors.response.use(res => res, async err => {
+   if (err.response?.status === 401 && !err.config._retry) {
+     err.config._retry = true;
+     await refreshToken();
+     return axios.request(err.config);
+   }
+   return Promise.reject(err);
+ });
    `,
    repoName: "DebugDiary/app",
    commitSha: "a1b2c3d4e5",
    modifiedFiles: ["src/api/client.ts"],
  };

  const extractedCard = await extractIncidentFromCommit(extractionInput);
  assert(typeof extractedCard.title === "string" && extractedCard.title.length > 0, "Extracted valid incident title");
  assert(extractedCard.category === "Authentication" || extractedCard.category === "API", "Categorized incident correctly");
  assert(typeof extractedCard.symptom === "string" && extractedCard.symptom.length > 0, "Extracted symptom description");
  assert(typeof extractedCard.rootCause === "string" && extractedCard.rootCause.length > 0, "Extracted root cause description");
  assert(typeof extractedCard.resolution === "string" && extractedCard.resolution.length > 0, "Extracted resolution steps");
  assert(Array.isArray(extractedCard.affectedFiles), "Returned affected files array");
  assert(extractedCard.confidenceScore > 0, "Calculated valid confidence score");

  console.log("\nSample Extracted Incident Card:");
  console.dir(extractedCard, { depth: null });

  console.log("\n=================================================");
  console.log(`📊 Test Summary: ${passedTests}/${totalTests} tests passed (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log("=================================================");

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runPratibhaVerificationTests().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
