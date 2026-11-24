import { Router, Request, Response } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth.middleware";
import {
  listIncidents,
  getReviewQueue,
  reviewIncident,
  getIncidentById,
} from "../services/incident.service";
import { computeWorkspaceSimilarityMesh } from "../services/similarity.service";

const router = Router();
router.use(authenticate);

const ReviewSchema = z.object({
  action: z.enum(["approve", "reject", "edit"]),
  mergeOnGithub: z.boolean().optional(),
  edits: z
    .object({
      title: z.string().optional(),
      category: z.string().optional(),
      tags: z.array(z.string()).optional(),
      symptom: z.string().optional(),
      rootCause: z.string().optional(),
      resolution: z.string().optional(),
      affectedFiles: z.array(z.string()).optional(),
    })
    .optional(),
});

// GET /api/incidents/review-queue (MUST be before /:id)
router.get("/review-queue", async (req: Request, res: Response) => {
  try {
    const { repository } = req.query;
    const result = await getReviewQueue(
      req.user!.workspaceId,
      repository as string | undefined
    );
    res.json(result);
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/incidents?status=verified&category=Authentication&search=JWT
router.get("/", async (req: Request, res: Response) => {
  try {
    const { status, category, search, repository } = req.query;
    const incidents = await listIncidents(req.user!.workspaceId, {
      status: status as string | undefined,
      category: category as string | undefined,
      search: search as string | undefined,
      repository: repository as string | undefined,
    });
    res.json({ incidents, total: incidents.length });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/incidents/similarity-mesh
router.get("/similarity-mesh", async (req: Request, res: Response) => {
  try {
    const threshold = req.query.threshold
      ? parseFloat(req.query.threshold as string)
      : 0.50;
    const { repository } = req.query;
    const edges = await computeWorkspaceSimilarityMesh(
      req.user!.workspaceId,
      threshold,
      repository as string | undefined
    );
    res.json({ edges, totalEdges: edges.length });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/incidents/:id
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const incident = await getIncidentById(
      req.params.id,
      req.user!.workspaceId
    );
    res.json({ incident });
  } catch (err: unknown) {
    res.status(404).json({ error: (err as Error).message });
  }
});

// POST /api/incidents/:id/review
router.post("/:id/review", async (req: Request, res: Response) => {
  try {
    const body = ReviewSchema.parse(req.body);
    const result = await reviewIncident(
      req.params.id,
      req.user!.workspaceId,
      req.user!.userId,
      body.action,
      body.edits,
      body.mergeOnGithub
    );
    res.json(result);
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Validation error", details: err.errors });
      return;
    }
    res.status(400).json({ error: (err as Error).message });
  }
});

export default router;
