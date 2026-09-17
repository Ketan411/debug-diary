import { Router, Request, Response } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth.middleware";
import { hybridSearch } from "../services/search.service";

const router = Router();
router.use(authenticate);

const SearchSchema = z.object({
  query: z.string().min(1, "Search query is required"),
  category: z.string().optional(),
  repository: z.string().optional(),
});

// POST /api/search
router.post("/", async (req: Request, res: Response) => {
  try {
    const body = SearchSchema.parse(req.body);
    const result = await hybridSearch(req.user!.workspaceId, body.query, {
      category: body.category,
      repository: body.repository,
    });
    res.json(result);
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Validation error", details: err.errors });
      return;
    }
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
