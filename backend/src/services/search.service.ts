import { prisma } from "../db/prisma";
import { statusToDisplay, getEvidence } from "../utils/format";
import { generateEmbedding, cosineSimilarity } from "./embedding.service";

// ============================================================================
// Embedding Cache
// Caches computed incident embedding vectors in memory to ensure fast
// response times (<5ms) on repeated queries and avoid redundant API/hash calls.
// ============================================================================
const incidentEmbeddingCache = new Map<string, { updatedAt: Date; vector: number[] }>();

export interface SearchFilters {
  category?: string;
  repository?: string;
}

export interface SearchResultItem {
  id: string;
  title: string;
  status: "Verified" | "Pending Review" | "Rejected";
  matchScore: number;
  category: string;
  tags: string[];
  symptom: string;
  rootCause: string;
  repository: string;
  evidence: string;
  evidenceType: "pr" | "commit";
  githubUrl: string;
}

/**
 * Phase 4: Hybrid Search Engine
 * Merges Lexical Keyword Search (BM25-style term frequency) with
 * Dense Vector Semantic Search (Cosine Similarity) using Reciprocal Rank Fusion (RRF).
 */
export async function hybridSearch(
  workspaceId: string,
  query: string,
  filters?: SearchFilters
): Promise<{ results: SearchResultItem[]; total: number }> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return { results: [], total: 0 };

  // Tokenize query into distinct search terms (filter out 1-letter noise)
  const queryTerms = trimmedQuery
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length > 1);

  if (queryTerms.length === 0) return { results: [], total: 0 };

  // 1. Fetch candidate verified incidents within the workspace
  const candidateIncidents = await prisma.incident.findMany({
    where: {
      workspaceId,
      status: "verified",
      ...(filters?.category && filters.category !== "All"
        ? { category: filters.category }
        : {}),
      ...(filters?.repository && filters.repository !== "All"
        ? { repository: { fullName: filters.repository } }
        : {}),
    },
    include: { repository: true },
    take: 100,
  });

  if (candidateIncidents.length === 0) {
    return { results: [], total: 0 };
  }

  // 2. Generate dense embedding vector for the incoming user query
  const queryVector = await generateEmbedding(trimmedQuery);

  // 3. Compute both Lexical and Semantic scores for each candidate incident
  interface ScoredCandidate {
    incident: (typeof candidateIncidents)[0];
    lexicalScore: number;
    semanticScore: number;
    lexicalRank?: number;
    semanticRank?: number;
    rrfScore: number;
    finalMatchScore: number;
  }

  const scoredCandidates: ScoredCandidate[] = [];

  for (const incident of candidateIncidents) {
    // 3a. Lexical Keyword Score (0 to 100)
    const lexicalScore = calculateLexicalScore(incident, queryTerms, trimmedQuery);

    // 3b. Semantic Vector Embedding Score (0 to 100)
    const incidentVector = await getOrComputeIncidentEmbedding(incident);
    const rawCosine = cosineSimilarity(queryVector, incidentVector);
    const semanticScore = Math.round(rawCosine * 100);

    scoredCandidates.push({
      incident,
      lexicalScore,
      semanticScore,
      rrfScore: 0,
      finalMatchScore: 0,
    });
  }

  // 4. Reciprocal Rank Fusion (RRF with industry standard k = 60)
  // Rank by Lexical score descending
  const lexicalSorted = [...scoredCandidates]
    .filter((c) => c.lexicalScore > 0)
    .sort((a, b) => b.lexicalScore - a.lexicalScore);

  lexicalSorted.forEach((item, index) => {
    item.lexicalRank = index + 1; // 1-based rank
  });

  // Rank by Semantic score descending (ignore orthogonal noise < 15%)
  const semanticSorted = [...scoredCandidates]
    .filter((c) => c.semanticScore > 15)
    .sort((a, b) => b.semanticScore - a.semanticScore);

  semanticSorted.forEach((item, index) => {
    item.semanticRank = index + 1; // 1-based rank
  });

  const RRF_K = 60;

  // 5. Calculate composite RRF score and calibrated final match score
  for (const item of scoredCandidates) {
    let rrf = 0;
    if (item.lexicalRank) {
      rrf += 1 / (RRF_K + item.lexicalRank);
    }
    if (item.semanticRank) {
      rrf += 1 / (RRF_K + item.semanticRank);
    }
    item.rrfScore = rrf;

    // Calibrated user-facing match score (0 to 100 percentage)
    // Hybrid weighting: 40% keyword match + 60% semantic similarity
    if (item.lexicalScore > 0 && item.semanticScore > 0) {
      item.finalMatchScore = Math.min(
        100,
        Math.round(0.4 * item.lexicalScore + 0.6 * item.semanticScore + 5)
      );
    } else if (item.lexicalScore > 0) {
      item.finalMatchScore = item.lexicalScore;
    } else {
      item.finalMatchScore = item.semanticScore;
    }
  }

  // 6. Filter out non-matching noise and sort by RRF rank descending
  const filteredResults = scoredCandidates
    .filter((item) => item.lexicalScore > 0 || item.semanticScore >= 35)
    .sort((a, b) => {
      if (b.rrfScore !== a.rrfScore) {
        return b.rrfScore - a.rrfScore;
      }
      return b.finalMatchScore - a.finalMatchScore;
    });

  // 7. Format output payload for frontend UI consumption
  const results: SearchResultItem[] = filteredResults.map(({ incident, finalMatchScore }) => {
    const { evidence, evidenceType } = getEvidence(incident);

    return {
      id: incident.id,
      title: incident.title,
      status: statusToDisplay(incident.status),
      matchScore: finalMatchScore,
      category: incident.category,
      tags: incident.tags ?? [],
      symptom: incident.symptom,
      rootCause: incident.rootCause,
      repository: incident.repository?.fullName ?? "Unknown",
      evidence,
      evidenceType,
      githubUrl: incident.githubUrl ?? "",
    };
  });

  return { results, total: results.length };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculates lexical relevance using term frequency and domain field weighting.
 * - Exact phrase match bonus: +25 points
 * - Title keyword match: 30 points per match
 * - Body keyword match (symptom, rootCause, resolution): 10 points per match
 * - Tag exact keyword match: 15 points per match
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function calculateLexicalScore(incident: any, terms: string[], fullQuery: string): number {
  const titleText = (incident.title || "").toLowerCase();
  const bodyText = [
    incident.symptom,
    incident.rootCause,
    incident.resolution,
    incident.commitMessage,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const tags = (incident.tags || []).map((t: string) => t.toLowerCase());

  let score = 0;

  // Exact phrase match bonus in title
  if (titleText.includes(fullQuery.toLowerCase())) {
    score += 25;
  }

  for (const term of terms) {
    const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escapedTerm}`, "gi");

    // Title matches
    const titleMatches = (titleText.match(regex) || []).length;
    score += titleMatches * 30;

    // Body matches
    const bodyMatches = (bodyText.match(regex) || []).length;
    score += bodyMatches * 10;

    // Tags matches
    if (tags.some((t: string) => t.includes(term))) {
      score += 15;
    }
  }

  return Math.min(Math.round(score), 100);
}

/**
 * Retrieves cached incident embedding or generates and caches a new one.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getOrComputeIncidentEmbedding(incident: any): Promise<number[]> {
  const cached = incidentEmbeddingCache.get(incident.id);
  if (cached && cached.updatedAt.getTime() === incident.updatedAt.getTime()) {
    return cached.vector;
  }

  // Combine title, symptom, root cause, resolution, and tags into a unified semantic document
  const textToEmbed = [
    incident.title,
    incident.symptom ? `Symptom: ${incident.symptom}` : "",
    incident.rootCause ? `Root Cause: ${incident.rootCause}` : "",
    incident.resolution ? `Resolution: ${incident.resolution}` : "",
    incident.tags?.length ? `Tags: ${incident.tags.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join(". ");

  const vector = await generateEmbedding(textToEmbed);
  incidentEmbeddingCache.set(incident.id, {
    updatedAt: incident.updatedAt,
    vector,
  });

  return vector;
}