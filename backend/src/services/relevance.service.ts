/**
 * Rule-Based Relevance Filter Engine
 * Determines whether a commit or pull request represents an actual bug fix
 * before triggering expensive LLM extraction calls.
 */

export interface RelevanceResult {
  isRelevant: boolean;
  score: number; // 0 to 100
  reason: string;
}

const BUG_KEYWORDS = [
  "fix",
  "bug",
  "hotfix",
  "resolve",
  "patch",
  "crash",
  "issue",
  "error",
  "exception",
  "repair",
  "overflow",
  "leak",
  "failure",
  "broken",
  "workaround",
  "correction",
  "regression",
  "nullpointer",
  "unhandled",
  "invalid",
];

const TRIVIAL_KEYWORDS = [
  "typo",
  "readme",
  "bump version",
  "version bump",
  "docs",
  "documentation",
  "style",
  "formatting",
  "prettier",
  "eslint",
  "changelog",
];

/**
 * Scores a commit message, diff, and file list to decide if AI processing should be executed.
 */
export function isRelevantCommit(
  commitMessage: string,
  diffText?: string,
  modifiedFiles: string[] = []
): RelevanceResult {
  const msgLower = (commitMessage || "").toLowerCase();
  const diffLower = (diffText || "").toLowerCase();

  let score = 0;
  const matchReasons: string[] = [];

  // 1. Check for explicit bug fix keywords in commit message
  const matchedKeywords = BUG_KEYWORDS.filter((kw) =>
    new RegExp(`\\b${kw}\\b`, "i").test(msgLower)
  );

  if (matchedKeywords.length > 0) {
    score += Math.min(matchedKeywords.length * 35, 70);
    matchReasons.push(`Keywords matched: ${matchedKeywords.join(", ")}`);
  }

  // 2. Check for trivial skip signals
  const isTrivial = TRIVIAL_KEYWORDS.some((kw) =>
    msgLower.includes(kw)
  );
  if (isTrivial && matchedKeywords.length === 0) {
    score -= 40;
    matchReasons.push("Contains non-bug / documentation indicator");
  }

  // 3. Check modified files (e.g. test files indicate regression fixes)
  const hasTestFiles = modifiedFiles.some(
    (f) =>
      f.includes("test") ||
      f.includes("spec") ||
      f.includes("__tests__")
  );
  if (hasTestFiles) {
    score += 20;
    matchReasons.push("Includes test suite modifications");
  }

  // 4. Check for exception or error stack signals in diff
  if (
    diffLower.includes("error") ||
    diffLower.includes("exception") ||
    diffLower.includes("catch") ||
    diffLower.includes("throw")
  ) {
    score += 15;
    matchReasons.push("Diff contains error handling logic");
  }

  // Final normalization (0 to 100)
  score = Math.max(0, Math.min(score, 100));
  const isRelevant = score >= 30;

  return {
    isRelevant,
    score,
    reason: isRelevant
      ? `Relevant bug fix detected (Score ${score}): ${matchReasons.join("; ")}`
      : `Skipped (Score ${score}): Not identified as a bug fix`,
  };
}
