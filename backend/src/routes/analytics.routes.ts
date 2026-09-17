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
    const data = await getDashboardAnalytics(req.user!.workspaceId);
    res.json(data);
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/analytics/hotspots
router.get("/hotspots", async (req: Request, res: Response) => {
  try {
    const data = await getHotspots(req.user!.workspaceId);
    res.json(data);
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
