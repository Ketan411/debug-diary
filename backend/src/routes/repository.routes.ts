import { Router, Request, Response } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth.middleware";
import { prisma } from "../db/prisma";
import {
  listRepositories,
  connectRepository,
  syncRepository,
  disconnectRepository,
  reconnectRepository,
  deleteRepository,
} from "../services/repository.service";

const router = Router();
router.use(authenticate);

const ConnectSchema = z.object({
  url: z.string().min(1, "GitHub URL is required"),
  description: z.string().optional(),
});

// GET /api/repositories/github/available
// Lists all GitHub repositories owned by or accessible to the logged in user
router.get("/github/available", async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { githubAccessToken: true, githubUsername: true },
    });

    if (!user?.githubAccessToken) {
      return res.json({
        connected: false,
        githubUsername: user?.githubUsername || null,
        repositories: [],
        message: "No GitHub token connected for this account. Sign in with GitHub to link your account.",
      });
    }

    const ghRes = await fetch(
      "https://api.github.com/user/repos?sort=updated&per_page=100&affiliation=owner,collaborator",
      {
        headers: {
          Authorization: `Bearer ${user.githubAccessToken}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "DebugDiary-App",
        },
      }
    );

    if (!ghRes.ok) {
      return res.json({
        connected: false,
        githubUsername: user.githubUsername,
        repositories: [],
        message: "GitHub access token expired or revoked. Please re-authenticate with GitHub.",
      });
    }

    const ghRepos = (await ghRes.json()) as Array<{
      id: number;
      name: string;
      full_name: string;
      description: string | null;
      html_url: string;
      private: boolean;
      default_branch: string;
      language: string | null;
      updated_at: string;
      stargazers_count: number;
    }>;

    const connectedRepos = await prisma.repository.findMany({
      where: { workspaceId: req.user!.workspaceId },
      select: { fullName: true, id: true, status: true },
    });

    const connectedMap = new Map(
      connectedRepos.map((r) => [r.fullName.toLowerCase(), r])
    );

    const repositories = ghRepos.map((r) => {
      const existing = connectedMap.get(r.full_name.toLowerCase());
      return {
        id: r.id,
        name: r.name,
        fullName: r.full_name,
        description: r.description || "",
        htmlUrl: r.html_url,
        isPrivate: r.private,
        defaultBranch: r.default_branch,
        language: r.language,
        updatedAt: r.updated_at,
        stars: r.stargazers_count,
        isConnected: !!existing,
        connectedId: existing?.id || null,
        status: existing?.status || null,
      };
    });

    res.json({
      connected: true,
      githubUsername: user.githubUsername,
      repositories,
      total: repositories.length,
    });
  } catch (err: unknown) {
    console.error("Failed to fetch available GitHub repositories:", err);
    res.status(500).json({ error: (err as Error).message, repositories: [] });
  }
});

// GET /api/repositories
router.get("/", async (req: Request, res: Response) => {
  try {
    const repos = await listRepositories(req.user!.workspaceId);
    res.json({ repositories: repos });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /api/repositories/connect
router.post("/connect", async (req: Request, res: Response) => {
  try {
    const body = ConnectSchema.parse(req.body);
    const repo = await connectRepository(
      req.user!.workspaceId,
      body.url,
      body.description
    );
    res.status(201).json({ repository: repo });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Validation error", details: err.errors });
      return;
    }
    res.status(400).json({ error: (err as Error).message });
  }
});

// POST /api/repositories/:id/sync
router.post("/:id/sync", async (req: Request, res: Response) => {
  try {
    const result = await syncRepository(
      req.user!.workspaceId,
      req.params.id,
      req.user!.userId
    );
    res.json(result);
  } catch (err: unknown) {
    res.status(404).json({ error: (err as Error).message });
  }
});

// POST /api/repositories/:id/disconnect
router.post("/:id/disconnect", async (req: Request, res: Response) => {
  try {
    const repo = await disconnectRepository(req.user!.workspaceId, req.params.id);
    res.json({ repository: repo, message: "Repository disconnected successfully" });
  } catch (err: unknown) {
    res.status(404).json({ error: (err as Error).message });
  }
});

// POST /api/repositories/:id/reconnect
router.post("/:id/reconnect", async (req: Request, res: Response) => {
  try {
    const repo = await reconnectRepository(req.user!.workspaceId, req.params.id);
    res.json({ repository: repo, message: "Repository reconnected successfully" });
  } catch (err: unknown) {
    res.status(404).json({ error: (err as Error).message });
  }
});

// DELETE /api/repositories/:id
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const result = await deleteRepository(req.user!.workspaceId, req.params.id);
    res.json(result);
  } catch (err: unknown) {
    res.status(404).json({ error: (err as Error).message });
  }
});

export default router;
