/**
 * frontend/src/lib/api.ts — Central API client for DebugDiary backend
 */

export const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.["VITE_API_URL"]) ||
  "http://localhost:5000/api";

// ─── Token Management ─────────────────────────────────────────────────────────

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("debugdiary_token");
}

export function setStoredToken(token: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem("debugdiary_token", token);
  }
}

export function clearStoredToken() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("debugdiary_token");
    localStorage.removeItem("debugdiary_user");
  }
}

// ─── Generic Fetch Wrapper ───────────────────────────────────────────────────

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options.headers as Record<string, string>) || {}),
  };

  const url = endpoint.startsWith("http")
    ? endpoint
    : `${API_BASE}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let errorMsg = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      errorMsg = data.error || data.message || errorMsg;
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }

  return res.json();
}

// ─── TypeScript Types Matching Backend Models ────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  initials?: string | undefined;
  department?: string | undefined;
}

export interface Workspace {
  id: string;
  name: string;
  role: string;
  isCurrent?: boolean;
  createdAt?: string;
  memberCount?: number;
  repositoryCount?: number;
  incidentCount?: number;
}

export interface WorkspaceDetail {
  id: string;
  name: string;
  role: string;
  createdAt: string;
  stats: {
    members: number;
    repositories: number;
    incidents: number;
  };
  members: Array<{
    userId: string;
    email: string;
    name: string;
    role: string;
  }>;
}

export interface Repository {
  id: string;
  name: string;
  description: string;
  status: "Connected" | "Disconnected" | "Syncing";
  lastSynced: string;
  commitsAnalyzed: string;
  bugFixesDetected: string;
  githubUrl?: string | undefined;
}

export interface AvailableGitHubRepo {
  id: number;
  name: string;
  fullName: string;
  description: string;
  htmlUrl: string;
  isPrivate: boolean;
  defaultBranch: string;
  language: string | null;
  updatedAt: string;
  stars: number;
  isConnected: boolean;
  connectedId: string | null;
  status: string | null;
}

export interface Incident {
  id: string;
  title: string;
  category: string;
  tags: string[];
  symptom: string;
  rootCause?: string | undefined;
  resolution?: string | undefined;
  status: string;
  repository: string;
  githubUrl?: string | undefined;
  evidence?: string | undefined;
  evidenceType?: "pr" | "commit" | undefined;
  updated?: string | undefined;
  createdAt?: string | undefined;
}

export interface ReviewIncident {
  id: string;
  title: string;
  category: string;
  tags: string[];
  confidence: number;
  symptom: string;
  rootCause: string;
  resolution: string;
  affectedFiles: string[];
  repository: string;
  commitMessage: string;
  commitSha: string;
  pullRequest: string;
  evidenceFiles: string[];
  githubUrl?: string | undefined;
}

export interface DashboardData {
  stats: {
    totalIncidents: number;
    verified: number;
    pendingReview: number;
    repositories: number;
  };
  trends: Array<{ month: string; incidents: number }>;
  recentIncidents: Array<{
    id: string;
    title: string;
    category: string;
    status: "Verified" | "Pending";
    updated: string;
  }>;
}

export interface SearchResult {
  id: string;
  title: string;
  status: "Verified" | "Pending Review";
  matchScore: number;
  category: string;
  tags: string[];
  symptom: string;
  rootCause?: string | undefined;
  repository: string;
  evidence: string;
  evidenceType: "pr" | "commit";
  githubUrl?: string | undefined;
}

// ─── Domain API Modules ───────────────────────────────────────────────────────

export const authApi = {
  async login(email: string, password: string): Promise<{ accessToken: string; user: User }> {
    const data = await apiFetch<{ accessToken: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setStoredToken(data.accessToken);
    if (typeof window !== "undefined") {
      localStorage.setItem("debugdiary_user", JSON.stringify(data.user));
    }
    return data;
  },

  async register(email: string, password: string, name: string): Promise<{ accessToken: string; user: User }> {
    const data = await apiFetch<{ accessToken: string; user: User }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    });
    setStoredToken(data.accessToken);
    if (typeof window !== "undefined") {
      localStorage.setItem("debugdiary_user", JSON.stringify(data.user));
    }
    return data;
  },

  async getMe(): Promise<User> {
    return apiFetch<User>("/auth/me");
  },

  getGithubAuthUrl(): string {
    return `${API_BASE}/auth/github`;
  },

  logout() {
    clearStoredToken();
  },
};

export const workspacesApi = {
  async list(): Promise<{ workspaces: Workspace[] }> {
    return apiFetch<{ workspaces: Workspace[] }>("/workspaces");
  },

  async get(id: string): Promise<{ workspace: WorkspaceDetail }> {
    return apiFetch<{ workspace: WorkspaceDetail }>(`/workspaces/${id}`);
  },

  async create(name: string): Promise<{
    workspace: Workspace;
    accessToken: string;
    token: string;
  }> {
    const data = await apiFetch<{
      workspace: Workspace;
      accessToken: string;
      token: string;
    }>("/workspaces", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    if (data.accessToken) {
      setStoredToken(data.accessToken);
    }
    return data;
  },

  async update(id: string, name: string): Promise<{ workspace: Workspace }> {
    return apiFetch<{ workspace: Workspace }>(`/workspaces/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    });
  },

  async delete(id: string): Promise<{
    success: boolean;
    nextWorkspaceId: string;
    accessToken: string;
  }> {
    const data = await apiFetch<{
      success: boolean;
      nextWorkspaceId: string;
      accessToken: string;
    }>(`/workspaces/${id}`, {
      method: "DELETE",
    });
    if (data.accessToken) {
      setStoredToken(data.accessToken);
    }
    return data;
  },

  async switch(id: string): Promise<{
    workspace: Workspace;
    accessToken: string;
  }> {
    const data = await apiFetch<{
      workspace: Workspace;
      accessToken: string;
    }>(`/workspaces/${id}/switch`, {
      method: "POST",
    });
    if (data.accessToken) {
      setStoredToken(data.accessToken);
    }
    return data;
  },

  async addMember(
    id: string,
    email: string,
    role: "ADMIN" | "MEMBER" | "VIEWER" = "MEMBER"
  ): Promise<{ member: { userId: string; email: string; name: string; role: string } }> {
    return apiFetch(`/workspaces/${id}/members`, {
      method: "POST",
      body: JSON.stringify({ email, role }),
    });
  },

  async removeMember(
    id: string,
    userId: string
  ): Promise<{ success: boolean; removedUserId: string }> {
    return apiFetch(`/workspaces/${id}/members/${userId}`, {
      method: "DELETE",
    });
  },
};

export const analyticsApi = {
  async getDashboard(): Promise<DashboardData> {
    return apiFetch<DashboardData>("/analytics/dashboard");
  },

  async getHotspots(): Promise<{
    topCategories: Array<{ category: string; count: number }>;
    hotspotFiles: Array<{ filePath: string; incidentCount: number }>;
  }> {
    return apiFetch<{
      topCategories: Array<{ category: string; count: number }>;
      hotspotFiles: Array<{ filePath: string; incidentCount: number }>;
    }>("/analytics/hotspots");
  },
};

export const incidentsApi = {
  async list(filters?: {
    status?: string | undefined;
    category?: string | undefined;
    search?: string | undefined;
  }): Promise<{ incidents: Incident[]; total: number }> {
    const params = new URLSearchParams();
    if (filters?.status) params.set("status", filters.status);
    if (filters?.category && filters.category !== "All") params.set("category", filters.category);
    if (filters?.search) params.set("search", filters.search);
    const qs = params.toString();
    return apiFetch<{ incidents: Incident[]; total: number }>(`/incidents${qs ? `?${qs}` : ""}`);
  },

  async get(id: string): Promise<{ incident: Incident }> {
    return apiFetch<{ incident: Incident }>(`/incidents/${id}`);
  },

  async getReviewQueue(): Promise<{ incidents: ReviewIncident[]; total: number }> {
    return apiFetch<{ incidents: ReviewIncident[]; total: number }>("/incidents/review-queue");
  },

  async review(
    id: string,
    action: "approve" | "reject" | "edit",
    edits?: Partial<ReviewIncident>,
    mergeOnGithub?: boolean
  ): Promise<{ message: string; incident?: Incident; mergedOnGithub?: boolean }> {
    return apiFetch<{ message: string; incident?: Incident; mergedOnGithub?: boolean }>(
      `/incidents/${id}/review`,
      {
        method: "POST",
        body: JSON.stringify({ action, edits, mergeOnGithub }),
      }
    );
  },
};

export const repositoriesApi = {
  async list(): Promise<{ repositories: Repository[] }> {
    return apiFetch<{ repositories: Repository[] }>("/repositories");
  },

  async connect(data: { url: string; description?: string | undefined }): Promise<{ repository: Repository }> {
    return apiFetch<{ repository: Repository }>("/repositories/connect", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async sync(id: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/repositories/${id}/sync`, {
      method: "POST",
    });
  },

  async disconnect(id: string): Promise<{ repository: Repository; message: string }> {
    return apiFetch<{ repository: Repository; message: string }>(`/repositories/${id}/disconnect`, {
      method: "POST",
    });
  },

  async reconnect(id: string): Promise<{ repository: Repository; message: string }> {
    return apiFetch<{ repository: Repository; message: string }>(`/repositories/${id}/reconnect`, {
      method: "POST",
    });
  },

  async delete(id: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/repositories/${id}`, {
      method: "DELETE",
    });
  },

  async listAvailableGitHub(): Promise<{
    connected: boolean;
    githubUsername?: string | null;
    repositories: AvailableGitHubRepo[];
    message?: string;
    total?: number;
  }> {
    return apiFetch<{
      connected: boolean;
      githubUsername?: string | null;
      repositories: AvailableGitHubRepo[];
      message?: string;
      total?: number;
    }>("/repositories/github/available");
  },
};

export const searchApi = {
  async search(
    query: string,
    filters?: { category?: string | undefined; repository?: string | undefined }
  ): Promise<{ results: SearchResult[]; total: number; query: string }> {
    return apiFetch<{ results: SearchResult[]; total: number; query: string }>("/search", {
      method: "POST",
      body: JSON.stringify({ query, ...filters }),
    });
  },
};

// ─── Webhooks API ────────────────────────────────────────────────────────────

export interface WebhookConfig {
  status: string;
  webhookUrl: string;
  secretConfigured: boolean;
  supportedEvents: string[];
  contentType: string;
}

export interface WebhookEventItem {
  id: string;
  deliveryId: string;
  eventType: string;
  repository: string;
  sender: string | null;
  commitsCount: number | null;
  processed: boolean;
  createdAt: string;
}

export const webhooksApi = {
  async getConfig(): Promise<WebhookConfig> {
    return apiFetch<WebhookConfig>("/webhooks/config");
  },

  async getRecentEvents(): Promise<{ events: WebhookEventItem[]; total: number }> {
    return apiFetch<{ events: WebhookEventItem[]; total: number }>("/webhooks/recent");
  },

  async sendTestPing(data?: { repository?: string; sender?: string }): Promise<{ message: string; result: unknown }> {
    return apiFetch<{ message: string; result: unknown }>("/webhooks/test-ping", {
      method: "POST",
      body: JSON.stringify(data || {}),
    });
  },
};

