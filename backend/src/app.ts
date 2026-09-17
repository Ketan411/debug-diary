import express, { Request } from "express";
import cors from "cors";
import morgan from "morgan";
import { errorMiddleware } from "./middleware/error.middleware";
import authRoutes from "./routes/auth.routes";
import workspaceRoutes from "./routes/workspace.routes";
import repositoryRoutes from "./routes/repository.routes";
import incidentRoutes from "./routes/incident.routes";
import searchRoutes from "./routes/search.routes";
import analyticsRoutes from "./routes/analytics.routes";
import webhookRoutes from "./routes/webhook.routes";

export function createApp() {
  const app = express();

  // ─── CORS ────────────────────────────────────────────────────────────────────
  app.use(
    cors({
      origin: [
        "http://localhost:8080", // Vite dev server (frontend)
        "http://localhost:3000",
        "http://localhost:5173",
      ],
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  );

  // ─── Request Logging ─────────────────────────────────────────────────────────
  app.use(morgan("dev"));

  // ─── JSON Body Parsing (with rawBody capture for webhook HMAC) ───────────────
  app.use(
    express.json({
      limit: "10mb",
      verify: (req: Request & { rawBody?: Buffer }, _res, buf) => {
        req.rawBody = buf;
      },
    })
  );

  // ─── Root & Health Check ─────────────────────────────────────────────────────
  app.get("/", (_req, res) => {
    res.json({
      name: "DebugDiary API",
      version: "2.0.0",
      status: "online",
      endpoints: {
        health: "/health",
        auth: "/api/auth",
        workspaces: "/api/workspaces",
        repositories: "/api/repositories",
        incidents: "/api/incidents",
        search: "/api/search",
        analytics: "/api/analytics",
        webhooks: "/api/webhooks",
      },
    });
  });

  app.get("/api", (_req, res) => {
    res.json({
      name: "DebugDiary API",
      version: "2.0.0",
      status: "online",
      endpoints: {
        health: "/health",
        auth: "/api/auth",
        workspaces: "/api/workspaces",
        repositories: "/api/repositories",
        incidents: "/api/incidents",
        search: "/api/search",
        analytics: "/api/analytics",
        webhooks: "/api/webhooks",
      },
    });
  });

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // ─── API Routes ───────────────────────────────────────────────────────────────
  app.use("/api/auth", authRoutes);
  app.use("/api/workspaces", workspaceRoutes);
  app.use("/api/repositories", repositoryRoutes);
  app.use("/api/incidents", incidentRoutes);
  app.use("/api/search", searchRoutes);
  app.use("/api/analytics", analyticsRoutes);
  app.use("/api/webhooks", webhookRoutes);

  // ─── 404 Handler ──────────────────────────────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({ error: "Route not found" });
  });

  // ─── Global Error Handler ─────────────────────────────────────────────────────
  app.use(errorMiddleware);

  return app;
}
