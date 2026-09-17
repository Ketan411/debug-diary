import { Router, Request, Response } from "express";
import {
  verifyGitHubSignature,
  handleWebhookEvent,
} from "../services/webhook.service";
import { prisma } from "../db/prisma";
import { env } from "../config/env";

const router = Router();

// GET /api/webhooks/config
router.get("/config", (_req: Request, res: Response) => {
  res.json({
    status: "listening",
    webhookUrl: "http://localhost:5000/api/webhooks/github",
    secretConfigured: !!env.GITHUB_WEBHOOK_SECRET,
    supportedEvents: ["push", "pull_request", "issues", "ping"],
    contentType: "application/json",
  });
});

// POST /api/webhooks/test-ping
router.post("/test-ping", async (req: Request, res: Response) => {
  try {
    const deliveryId = `test-ping-${Date.now()}`;
    const result = await handleWebhookEvent("ping", deliveryId, {
      zen: "Responsive, real-time debugging.",
      hook_id: 999999,
      repository: { full_name: req.body?.repository || "DebugDiary/test-repo" },
      sender: { login: req.body?.sender || "system" },
    });
    res.json({ message: "Test ping dispatched and recorded successfully", result });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/webhooks/recent
router.get("/recent", async (_req: Request, res: Response) => {
  try {
    const events = await prisma.rawWebhookEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    const formatted = events.map((e) => {
      const payload = e.payload as {
        repository?: { full_name?: string };
        sender?: { login?: string };
        commits?: unknown[];
      };
      return {
        id: e.id,
        deliveryId: e.deliveryId,
        eventType: e.eventType,
        repository: payload?.repository?.full_name ?? "General / Ping",
        sender: payload?.sender?.login ?? null,
        commitsCount: Array.isArray(payload?.commits) ? payload.commits.length : null,
        processed: e.processed,
        createdAt: e.createdAt,
      };
    });

    res.json({ events: formatted, total: events.length });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message, events: [] });
  }
});

// POST /api/webhooks/github
// Note: rawBody is captured in app.ts via express.json verify option
router.post("/github", async (req: Request, res: Response) => {
  try {
    const signature = req.headers["x-hub-signature-256"] as string;
    const deliveryId = req.headers["x-github-delivery"] as string;
    const eventType = (req.headers["x-github-event"] as string) ?? "unknown";

    if (!deliveryId) {
      res.status(400).json({ error: "Missing X-GitHub-Delivery header" });
      return;
    }

    // Verify HMAC signature when present
    if (signature) {
      const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
      if (rawBody && !verifyGitHubSignature(rawBody, signature)) {
        res.status(401).json({ error: "Invalid webhook signature" });
        return;
      }
    }

    const result = await handleWebhookEvent(eventType, deliveryId, req.body);
    res.json(result);
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
