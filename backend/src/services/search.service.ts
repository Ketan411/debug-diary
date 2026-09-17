import { prisma } from "../db/prisma";
import { statusToDisplay, getEvidence } from "../utils/format";

// ─── Hybrid Search ────────────────────────────────────────────────────────────
// Phase 1: PostgreSQL full-text search with relevance scoring.
// Phase 4 (future): Add pgvector cosine similarity on top.

export async function hybridSearch(
  workspaceId: string,
  query: string,
  filters?: { category?: string; repository?: string }
) {
  if (!query.trim()) return { results: [], total: 0 };

  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 1); // ignore single-char tokens

  if (terms.length === 0) return { results: [], total: 0 };

  // Build OR conditions across all searchable text fields
  const incidents = await prisma.incident.findMany({
    where: {
      workspaceId,
      status: "verified", // only search confirmed fixes
      OR: terms.flatMap((term) => [
        { title: { contains: term, mode: "insensitive" } },
        { symptom: { contains: term, mode: "insensitive" } },
        { rootCause: { contains: term, mode: "insensitive" } },
        { resolution: { contains: term, mode: "insensitive" } },
        { category: { contains: term, mode: "insensitive" } },
        { commitMessage: { contains: term, mode: "insensitive" } },
      ]),
    },
    include: { repository: true },
    take: 50,
  });

  // Client-side repository filter
  let results = incidents;
  if (filters?.repository && filters.repository !== "All") {
    results = incidents.filter(
      (i) => i.repository?.fullName === filters.repository
    );
  }
  if (filters?.category && filters.category !== "All") {
    results = results.filter((i) => i.category === filters.category);
  }

  // Relevance scoring
  const scored = results
    .map((incident) => {
      const score = calculateMatchScore(incident, terms);
      const { evidence, evidenceType } = getEvidence(incident);

      return {
        id: incident.id,
        title: incident.title,
        status: statusToDisplay(incident.status),
        matchScore: score,
        category: incident.category,
        tags: incident.tags ?? [],
        symptom: incident.symptom,
        rootCause: incident.rootCause,
        repository: incident.repository?.fullName ?? "Unknown",
        evidence,
        evidenceType,
        githubUrl: incident.githubUrl ?? "",
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore);

  return { results: scored, total: scored.length };
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function calculateMatchScore(incident: any, terms: string[]): number {
  const titleText = incident.title.toLowerCase();
  const bodyText = [
    incident.symptom,
    incident.rootCause,
    incident.resolution,
    ...(incident.tags ?? []),
    incident.commitMessage ?? "",
  ]
    .join(" ")
    .toLowerCase();

  let score = 0;

  for (const term of terms) {
    const regex = new RegExp(term, "gi");

    // Title match is worth more
    const titleMatches = (titleText.match(regex) ?? []).length;
    score += titleMatches * 30;

    // Body matches
    const bodyMatches = (bodyText.match(regex) ?? []).length;
    score += bodyMatches * 10;

    // Tags exact match bonus
    if ((incident.tags ?? []).some((t: string) =>
      t.toLowerCase().includes(term)
    )) {
      score += 15;
    }
  }

  // Normalize to 0–100
  return Math.min(Math.round(score), 100);
}
