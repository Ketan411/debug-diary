import OpenAI from "openai";
import { env } from "../config/env";

export interface IncidentExtractionResult {
  title: string;
  category: "Authentication" | "Database" | "API" | "CI/CD" | "Frontend" | "Infrastructure";
  symptom: string;
  rootCause: string;
  resolution: string;
  affectedFiles: string[];
  tags: string[];
  confidenceScore: number;
}

export interface ExtractIncidentParams {
  commitMessage: string;
  diff?: string;
  repoName?: string;
  commitSha?: string;
  pullRequest?: string;
  htmlUrl?: string;
  modifiedFiles?: string[];
}

// Instantiate OpenAI client targeting Open-Source LLM provider (Groq, Ollama, vLLM, LM Studio)
function getLLMClient(): OpenAI | null {
  const apiKey = env.LLM_API_KEY || process.env.GROQ_API_KEY || "ollama";
  const baseURL = env.LLM_BASE_URL || "https://api.groq.com/openai/v1";

  try {
    return new OpenAI({
      apiKey,
      baseURL,
    });
  } catch (err) {
    console.warn("Failed to initialize Open-Source LLM client:", err);
    return null;
  }
}

/**
 * Extracts a structured Incident card from a sanitized commit diff / PR payload using an Open-Source LLM.
 */
export async function extractIncidentFromCommit(
  params: ExtractIncidentParams
): Promise<IncidentExtractionResult> {
  const client = getLLMClient();
  const modelName = env.LLM_MODEL || "llama-3.3-70b-versatile";

  const promptText = `
You are DebugDiary's expert AI Incident Extraction Engine.
Analyze the following Git commit message and code diff, and extract a structured incident summary card.

CRITICAL INSTRUCTIONS:
Return ONLY a valid JSON object matching this exact schema:
{
  "title": "Short concise summary title of the bug & fix (max 10 words)",
  "category": "Authentication" | "Database" | "API" | "CI/CD" | "Frontend" | "Infrastructure",
  "symptom": "What symptom, error message, or issue occurred for users or systems",
  "rootCause": "Technical root cause explanation of why the code broke",
  "resolution": "Technical summary of how the commit diff resolved the issue",
  "affectedFiles": ["list", "of", "relative", "filepaths"],
  "tags": ["relevant", "lowercase", "tags"],
  "confidenceScore": 0.85
}

--- INPUT DATA ---
Repository: ${params.repoName ?? "Unknown Repo"}
Commit Message: ${params.commitMessage}
Modified Files: ${(params.modifiedFiles ?? []).join(", ") || "None specified"}
Code Diff / Context:
${params.diff ? params.diff.slice(0, 3000) : "No code diff provided."}
--- END INPUT DATA ---
`;

  if (client && (env.LLM_API_KEY || env.LLM_BASE_URL.includes("localhost"))) {
    try {
      const completion = await client.chat.completions.create({
        model: modelName,
        messages: [
          {
            role: "system",
            content:
              "You are an AI developer tool that extracts bug reports from Git diffs into structured JSON.",
          },
          { role: "user", content: promptText },
        ],
        temperature: 0.1,
        response_format: { type: "json_object" },
      });

      const responseText = completion.choices[0]?.message?.content?.trim();

      if (responseText) {
        // Strip markdown code block formatting if present
        const jsonString = responseText
          .replace(/^```json\s*/i, "")
          .replace(/^```\s*/i, "")
          .replace(/```$/i, "")
          .trim();

        const parsed = JSON.parse(jsonString) as Partial<IncidentExtractionResult>;

        return sanitizeExtractionResult(parsed, params);
      }
    } catch (err: unknown) {
      console.warn(
        `Open-Source LLM call (${modelName}) failed or unreachable, falling back to heuristic extractor:`,
        (err as Error).message
      );
    }
  }

  // Fallback heuristic extractor if LLM API is omitted or unreachable
  return fallbackExtractionResult(params);
}

/**
 * Validates and sanitizes LLM JSON output to match entity structure.
 */
function sanitizeExtractionResult(
  raw: Partial<IncidentExtractionResult>,
  params: ExtractIncidentParams
): IncidentExtractionResult {
  const validCategories = [
    "Authentication",
    "Database",
    "API",
    "CI/CD",
    "Frontend",
    "Infrastructure",
  ] as const;

  const category = validCategories.includes(raw.category as any)
    ? (raw.category as IncidentExtractionResult["category"])
    : inferCategory(params.commitMessage);

  return {
    title: raw.title?.trim() || params.commitMessage.slice(0, 60),
    category,
    symptom: raw.symptom?.trim() || `Bug encountered in commit: ${params.commitMessage}`,
    rootCause: raw.rootCause?.trim() || `Unhandled state or exception in ${params.commitMessage}`,
    resolution: raw.resolution?.trim() || `Resolved via commit update`,
    affectedFiles: Array.isArray(raw.affectedFiles) && raw.affectedFiles.length > 0
      ? raw.affectedFiles
      : params.modifiedFiles ?? [],
    tags: Array.isArray(raw.tags) && raw.tags.length > 0
      ? raw.tags.map((t) => t.toLowerCase())
      : [category.toLowerCase(), "bug-fix"],
    confidenceScore:
      typeof raw.confidenceScore === "number" && raw.confidenceScore > 0
        ? Math.min(raw.confidenceScore, 1.0)
        : 0.85,
  };
}

/**
 * Fallback structured generator when LLM API key is not configured or server is offline.
 */
function fallbackExtractionResult(
  params: ExtractIncidentParams
): IncidentExtractionResult {
  const category = inferCategory(params.commitMessage);
  const msg = params.commitMessage.trim();

  return {
    title: msg.replace(/^(fix|bug|hotfix|resolve|patch):\s*/i, "").slice(0, 60),
    category,
    symptom: `Observed issue or error reported in commit: ${msg}`,
    rootCause: `Defect or missing validation identified in commit: ${msg}`,
    resolution: `Fix applied and verified in commit ${params.commitSha ? params.commitSha.slice(0, 7) : ""}`,
    affectedFiles: params.modifiedFiles ?? [],
    tags: ["auto-extracted", category.toLowerCase(), "git-push"],
    confidenceScore: 0.75,
  };
}

function inferCategory(text: string): IncidentExtractionResult["category"] {
  const lower = text.toLowerCase();
  if (lower.includes("auth") || lower.includes("jwt") || lower.includes("token") || lower.includes("login")) {
    return "Authentication";
  }
  if (lower.includes("db") || lower.includes("sql") || lower.includes("prisma") || lower.includes("postgres")) {
    return "Database";
  }
  if (lower.includes("ui") || lower.includes("css") || lower.includes("react") || lower.includes("frontend")) {
    return "Frontend";
  }
  if (lower.includes("ci") || lower.includes("docker") || lower.includes("deploy") || lower.includes("action")) {
    return "CI/CD";
  }
  if (lower.includes("infra") || lower.includes("server") || lower.includes("nginx")) {
    return "Infrastructure";
  }
  return "API";
}
