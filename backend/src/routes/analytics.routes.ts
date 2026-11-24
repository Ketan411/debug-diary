import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/auth.middleware";
import {
  getDashboardAnalytics,
  getHotspots,
} from "../services/analytics.service";

const router = Router();
router.use(authenticate);

// GET /api/analytics/dashboard
router.get("/dashboard", async (req: Request, res: Response) => {
  try {
    const { repository } = req.query;
    const data = await getDashboardAnalytics(
      req.user!.workspaceId,
      repository as string | undefined
    );
    res.json(data);
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/analytics/hotspots
router.get("/hotspots", async (req: Request, res: Response) => {
  try {
    const { repository } = req.query;
    const data = await getHotspots(
      req.user!.workspaceId,
      repository as string | undefined
    );
    res.json(data);
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
