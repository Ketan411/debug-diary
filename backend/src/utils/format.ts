import { formatDistanceToNow } from "date-fns";

// ─── Date Formatting ──────────────────────────────────────────────────────────

export function formatRelativeTime(date: Date | null | undefined): string {
  if (!date) return "Never";
  try {
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return "Unknown";
  }
}

// ─── Number Formatting ────────────────────────────────────────────────────────

export function formatNumber(num: number): string {
  return num.toLocaleString("en-US");
}

// ─── Incident Status Mapping ─────────────────────────────────────────────────

export function statusToDisplay(
  status: string
): "Verified" | "Pending Review" | "Rejected" {
  switch (status) {
    case "verified":
      return "Verified";
    case "rejected":
      return "Rejected";
    default:
      return "Pending Review";
  }
}

// ─── Evidence Derivation ─────────────────────────────────────────────────────

export function getEvidence(incident: {
  pullRequest: string | null;
  commitSha: string | null;
}): { evidence: string; evidenceType: "pr" | "commit" } {
  if (incident.pullRequest) {
    return { evidence: incident.pullRequest, evidenceType: "pr" };
  }
  if (incident.commitSha) {
    return {
      evidence: `Commit ${incident.commitSha.slice(0, 7)}`,
      evidenceType: "commit",
    };
  }
  return { evidence: "", evidenceType: "commit" };
}

// ─── Name Initials ────────────────────────────────────────────────────────────

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}
