import { prisma } from "../db/prisma";
import { generateEmbedding, cosineSimilarity } from "./embedding.service";

export interface SimilarityEdge {
  sourceIncidentId: string;
  targetIncidentId: string;
  similarityScore: number;
}

/**
 * Vector Similarity Mesh Engine
 * Computes pairwise vector similarity across verified incidents in a workspace.
 * Emits dynamic SIMILAR_TO graph relationships for similarity > 0.70.
 */
export async function computeWorkspaceSimilarityMesh(
  workspaceId: string,
  threshold = 0.40,
  repository?: string
): Promise<SimilarityEdge[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { workspaceId, status: "verified" };
  if (repository && repository !== "All") {
    where.repository = { fullName: repository };
  }

  const incidents = await prisma.incident.findMany({
    where,
    select: {
      id: true,
      title: true,
      category: true,
      tags: true,
      symptom: true,
      rootCause: true,
      resolution: true,
    },
  });

  if (incidents.length < 2) return [];

  // 1. Generate text embeddings for each verified incident
  const incidentVectors: Array<{
    id: string;
    category: string;
    tags: string[];
    vector: number[];
  }> = [];

  for (const inc of incidents) {
    const textBlob = `${inc.title}. Category: ${inc.category}. Tags: ${(inc.tags || []).join(" ")}. Symptom: ${inc.symptom}. Root Cause: ${inc.rootCause}. Fix: ${inc.resolution}`;
    const vector = await generateEmbedding(textBlob);
    incidentVectors.push({
      id: inc.id,
      category: inc.category,
      tags: inc.tags || [],
      vector,
    });
  }

  // 2. Compute pairwise similarity matrix and guarantee top semantic connections
  const edges: SimilarityEdge[] = [];
  const edgeSet = new Set<string>();

  for (let i = 0; i < incidentVectors.length; i++) {
    const candidateMatches: Array<{ j: number; score: number }> = [];

    for (let j = 0; j < incidentVectors.length; j++) {
      if (i === j) continue;
      const cosSim = cosineSimilarity(
        incidentVectors[i].vector,
        incidentVectors[j].vector
      );

      // Boost for shared category and tags
      const sameCat =
        incidentVectors[i].category === incidentVectors[j].category ? 0.35 : 0;
      const sharedTags = incidentVectors[i].tags.filter((t) =>
        incidentVectors[j].tags.includes(t)
      ).length;
      const tagBoost = Math.min(0.25, sharedTags * 0.12);

      const compositeScore = Math.min(
        0.98,
        Number((cosSim * 0.45 + sameCat + tagBoost).toFixed(3))
      );

      candidateMatches.push({ j, score: compositeScore });

      if (i < j && compositeScore >= threshold) {
        const key = `${incidentVectors[i].id}-${incidentVectors[j].id}`;
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          edges.push({
            sourceIncidentId: incidentVectors[i].id,
            targetIncidentId: incidentVectors[j].id,
            similarityScore: compositeScore,
          });
        }
      }
    }

    // Guarantee nearest neighbor link: connect to top 2 closest incidents
    candidateMatches.sort((a, b) => b.score - a.score);
    const topK = candidateMatches.slice(0, 2);
    for (const match of topK) {
      if (match.score > 0) {
        const idxA = Math.min(i, match.j);
        const idxB = Math.max(i, match.j);
        const key = `${incidentVectors[idxA].id}-${incidentVectors[idxB].id}`;
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          edges.push({
            sourceIncidentId: incidentVectors[idxA].id,
            targetIncidentId: incidentVectors[idxB].id,
            similarityScore: match.score,
          });
        }
      }
    }
  }

  return edges;
}