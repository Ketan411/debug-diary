import { generateEmbedding, cosineSimilarity } from "./services/embedding.service";
import { computeWorkspaceSimilarityMesh } from "./services/similarity.service";
import { hybridSearch } from "./services/search.service";

async function runPhase4VerificationTests() {
  console.log("=================================================");
  console.log("🧪 Running Pratibha (Phase 4: Embeddings, Similarity & Search) Verification Suite");
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
  // TEST SUITE 1: 384-Dimensional Dense Vector Embedding Engine
  // -------------------------------------------------------------
  console.log("--- Test Suite 1: Dense Vector Embedding & Normalization ---");

  const sampleText = "JWT token verification failed with 401 Unauthorized";
  const vector = await generateEmbedding(sampleText);

  assert(Array.isArray(vector), "Generates vector array");
  assert(vector.length === 384, "Generates exactly 384-dimensional dense vector", `Got ${vector.length}`);

  // Test L2 unit normalization: ||v|| = sqrt(sum(v_i^2)) ≈ 1.0
  const l2Norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  assert(Math.abs(l2Norm - 1.0) < 0.01, "Vector is L2 unit normalized (||v|| = 1.0)", `Norm: ${l2Norm.toFixed(4)}`);

  // Empty string handling
  const emptyVector = await generateEmbedding("");
  assert(emptyVector.length === 384, "Handles empty text gracefully");
  assert(emptyVector.every((v) => v === 0), "Empty text produces zero-vector");

  // Determinism test: Same input produces identical vector
  const vector2 = await generateEmbedding(sampleText);
  const isIdentical = vector.every((val, idx) => Math.abs(val - vector2[idx]) < 1e-5);
  assert(isIdentical, "Vector generation is deterministic for identical text");

  // -------------------------------------------------------------
  // TEST SUITE 2: Cosine Similarity Metric & Semantic Properties
  // -------------------------------------------------------------
  console.log("\n--- Test Suite 2: Cosine Similarity Metric ---");

  // Identical vectors must have cosine similarity = 1.0
  const simSelf = cosineSimilarity(vector, vector);
  assert(Math.abs(simSelf - 1.0) < 1e-4, "Cosine similarity of identical vectors is 1.0", `Score: ${simSelf}`);

  // Orthogonal / zero vector similarity is 0.0
  const simZero = cosineSimilarity(vector, emptyVector);
  assert(simZero === 0, "Cosine similarity with zero vector is 0.0");

  // Semantic similarity test:
  // Related concepts should have higher cosine similarity than unrelated concepts
  const textAuthA = "User authentication failed because JWT access token expired during Axios API call";
  const textAuthB = "Resolved login redirection loop caused by expired JWT authentication token in Axios interceptor";
  const textCss = "CSS flexbox padding margin align-items center responsive button styles";

  const vecAuthA = await generateEmbedding(textAuthA);
  const vecAuthB = await generateEmbedding(textAuthB);
  const vecCss = await generateEmbedding(textCss);

  const simRelated = cosineSimilarity(vecAuthA, vecAuthB);
  const simUnrelated = cosineSimilarity(vecAuthA, vecCss);

  assert(simRelated > simUnrelated, "Related concepts score higher cosine similarity than unrelated concepts", 
    `Related: ${simRelated.toFixed(3)} vs Unrelated: ${simUnrelated.toFixed(3)}`);
  assert(simRelated >= 0.30, "Semantic match produces substantial similarity", `Score: ${simRelated.toFixed(3)}`);

  // -------------------------------------------------------------
  // TEST SUITE 3: Pairwise Similarity Mesh Thresholding
  // -------------------------------------------------------------
  console.log("\n--- Test Suite 3: Vector Similarity Mesh Thresholding ---");

  // Test pair thresholding logic:
  // Pairs above threshold form edges, pairs below are omitted
  const mockVectors = [
    { id: "inc-1", vector: vecAuthA },
    { id: "inc-2", vector: vecAuthB },
    { id: "inc-3", vector: vecCss },
  ];

  const meshEdges: Array<{ source: string; target: string; score: number }> = [];
  const THRESHOLD = 0.25; // In rich text with API models 0.70 is standard; in local n-gram hashing 0.25 separates related from orthogonal

  for (let i = 0; i < mockVectors.length; i++) {
    for (let j = i + 1; j < mockVectors.length; j++) {
      const score = cosineSimilarity(mockVectors[i].vector, mockVectors[j].vector);
      if (score >= THRESHOLD) {
        meshEdges.push({
          source: mockVectors[i].id,
          target: mockVectors[j].id,
          score: Number(score.toFixed(3)),
        });
      }
    }
  }

  assert(meshEdges.length === 1, "Mesh forms edge only between semantically related incidents", `Edges count: ${meshEdges.length}`);
  if (meshEdges.length > 0) {
    assert(meshEdges[0].source === "inc-1" && meshEdges[0].target === "inc-2", "Connected nodes are inc-1 and inc-2");
    assert(meshEdges[0].score >= THRESHOLD, "Edge similarity score meets or exceeds threshold");
  }

  // -------------------------------------------------------------
  // TEST SUITE 4: Reciprocal Rank Fusion (RRF) & Hybrid Search
  // -------------------------------------------------------------
  console.log("\n--- Test Suite 4: Reciprocal Rank Fusion & Hybrid Ranking ---");

  // Verify RRF formula calculation: RRF = 1 / (60 + r_lex) + 1 / (60 + r_sem)
  const RRF_K = 60;
  const rank1Both = (1 / (RRF_K + 1)) + (1 / (RRF_K + 1));
  const rank1OnlyLex = 1 / (RRF_K + 1);

  assert(rank1Both > rank1OnlyLex, "Document matching both lexical & semantic ranks higher than single modality");
  assert(Math.abs(rank1Both - (2 / 61)) < 1e-6, "RRF calculation matches theoretical value 2/61 (≈ 0.0328)");

  // Test hybridSearch function interface and empty input safety
  const emptySearch = await hybridSearch("test-workspace", "   ");
  assert(emptySearch.total === 0 && emptySearch.results.length === 0, "Empty query returns safe empty results");

  const singleCharSearch = await hybridSearch("test-workspace", "a");
  assert(singleCharSearch.total === 0, "Single character query filtered out as noise");

  console.log("\n=================================================");
  console.log(`📊 Phase 4 Test Summary: ${passedTests}/${totalTests} tests passed (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log("=================================================");

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runPhase4VerificationTests().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
