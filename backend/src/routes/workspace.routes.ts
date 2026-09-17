import { Router, Request, Response } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth.middleware";
import {
  listWorkspaces,
  getWorkspace,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  switchWorkspace,
  addWorkspaceMember,
  removeWorkspaceMember,
} from "../services/workspace.service";

const router = Router();
router.use(authenticate);

const CreateWorkspaceSchema = z.object({
  name: z.string().min(2, "Workspace name must be at least 2 characters"),
});

const UpdateWorkspaceSchema = z.object({
  name: z.string().min(2, "Workspace name must be at least 2 characters").optional(),
});

const AddMemberSchema = z.object({
  email: z.string().email("Valid email address required"),
  role: z.enum(["ADMIN", "MEMBER", "VIEWER"]).default("MEMBER"),
});

// ─── GET /api/workspaces — List all workspaces for the current user ──────────
router.get("/", async (req: Request, res: Response) => {
  try {
    const workspaces = await listWorkspaces(
      req.user!.userId,
      req.user!.workspaceId
    );
    res.json({ workspaces });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── POST /api/workspaces — Create a new workspace ────────────────────────────
router.post("/", async (req: Request, res: Response) => {
  try {
    const body = CreateWorkspaceSchema.parse(req.body);
    const result = await createWorkspace(
      req.user!.userId,
      req.user!.email,
      body.name
    );
    res.status(201).json(result);
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Validation error", details: err.errors });
      return;
    }
    res.status(400).json({ error: (err as Error).message });
  }
});

// ─── GET /api/workspaces/:id — Get details of a specific workspace ────────────
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const workspace = await getWorkspace(req.params.id, req.user!.userId);
    res.json({ workspace });
  } catch (err: unknown) {
    res.status(404).json({ error: (err as Error).message });
  }
});

// ─── PATCH /api/workspaces/:id — Update workspace name or settings ───────────
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const body = UpdateWorkspaceSchema.parse(req.body);
    const updated = await updateWorkspace(
      req.params.id,
      req.user!.userId,
      body
    );
    res.json({ workspace: updated });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Validation error", details: err.errors });
      return;
    }
    res.status(400).json({ error: (err as Error).message });
  }
});

// ─── DELETE /api/workspaces/:id — Delete workspace ────────────────────────────
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const result = await deleteWorkspace(
      req.params.id,
      req.user!.userId,
      req.user!.email
    );
    res.json(result);
  } catch (err: unknown) {
    res.status(400).json({ error: (err as Error).message });
  }
});

// ─── POST /api/workspaces/:id/switch — Switch active workspace ────────────────
router.post("/:id/switch", async (req: Request, res: Response) => {
  try {
    const result = await switchWorkspace(
      req.params.id,
      req.user!.userId,
      req.user!.email
    );
    res.json(result);
  } catch (err: unknown) {
    res.status(400).json({ error: (err as Error).message });
  }
});

// ─── POST /api/workspaces/:id/members — Add member ───────────────────────────
router.post("/:id/members", async (req: Request, res: Response) => {
  try {
    const body = AddMemberSchema.parse(req.body);
    const member = await addWorkspaceMember(
      req.params.id,
      req.user!.userId,
      body.email,
      body.role
    );
    res.status(201).json({ member });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Validation error", details: err.errors });
      return;
    }
    res.status(400).json({ error: (err as Error).message });
  }
});

// ─── DELETE /api/workspaces/:id/members/:userId — Remove member ───────────────
router.delete("/:id/members/:userId", async (req: Request, res: Response) => {
  try {
    const result = await removeWorkspaceMember(
      req.params.id,
      req.user!.userId,
      req.params.userId
    );
    res.json(result);
  } catch (err: unknown) {
    res.status(400).json({ error: (err as Error).message });
  }
});

export default router;
