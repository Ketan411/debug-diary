import { Router, Request, Response } from "express";
import { z } from "zod";
import {
  registerUser,
  loginUser,
  getCurrentUser,
  findOrCreateGitHubUser,
} from "../services/auth.service";
import { authenticate } from "../middleware/auth.middleware";
import { env } from "../config/env";

const router = Router();

const RegisterSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(2, "Name must be at least 2 characters"),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});

// POST /api/auth/register
router.post("/register", async (req: Request, res: Response) => {
  try {
    const body = RegisterSchema.parse(req.body);
    const result = await registerUser(body.email, body.password, body.name);
    res.status(201).json(result);
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Validation error", details: err.errors });
      return;
    }
    const message = (err as Error).message;
    if (message.includes("already exists")) {
      res.status(409).json({ error: message });
      return;
    }
    res.status(400).json({ error: message });
  }
});

// POST /api/auth/login
router.post("/login", async (req: Request, res: Response) => {
  try {
    const body = LoginSchema.parse(req.body);
    const result = await loginUser(body.email, body.password);
    res.json(result);
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Validation error", details: err.errors });
      return;
    }
    res.status(401).json({ error: (err as Error).message });
  }
});

// GET /api/auth/me  (protected)
router.get("/me", authenticate, async (req: Request, res: Response) => {
  try {
    const user = await getCurrentUser(req.user!.userId);
    res.json(user);
  } catch (err: unknown) {
    res.status(404).json({ error: (err as Error).message });
  }
});

// GET /api/auth/github
router.get("/github", (req: Request, res: Response) => {
  const isConfigured =
    env.GITHUB_CLIENT_ID &&
    env.GITHUB_CLIENT_ID.trim() !== "" &&
    env.GITHUB_CLIENT_ID !== "your_github_client_id";

  if (isConfigured) {
    const returnTo = (req.query.returnTo as string) || "/dashboard";
    const redirectUri = encodeURIComponent(
      `http://localhost:5000/api/auth/github/callback`
    );
    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${env.GITHUB_CLIENT_ID}&scope=user:email,repo&redirect_uri=${redirectUri}&prompt=consent&state=${encodeURIComponent(returnTo)}`;
    res.redirect(githubAuthUrl);
  } else {
    // Seamless development mode fallback when GITHUB_CLIENT_ID is not configured
    res.redirect("/api/auth/github/callback?dev=true");
  }
});

// GET /api/auth/github/callback
router.get("/github/callback", async (req: Request, res: Response) => {
  try {
    const { code, dev, state } = req.query;
    const returnTo = (state as string) || "/dashboard";
    let email = "github-dev@debugdiary.com";
    let name = "GitHub Developer";

    if (dev === "true" || !code) {
      const result = await findOrCreateGitHubUser({ email, name });
      const targetPath = returnTo.startsWith("/") ? returnTo : "/dashboard";
      return res.redirect(
        `${env.FRONTEND_URL}${targetPath}?token=${result.accessToken}&provider=github`
      );
    }

    if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
      throw new Error("GitHub OAuth credentials not configured on backend");
    }

    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "DebugDiary-App",
      },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });

    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      error_description?: string;
    };
    if (!tokenData.access_token) {
      throw new Error(
        tokenData.error_description || "Failed to obtain GitHub access token"
      );
    }

    const ghUserRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "User-Agent": "DebugDiary-App",
      },
    });
    const ghUser = (await ghUserRes.json()) as {
      name?: string;
      login?: string;
      email?: string;
    };
    name = ghUser.name || ghUser.login || "GitHub Developer";

    if (ghUser.email) {
      email = ghUser.email;
    } else {
      const emailsRes = await fetch("https://api.github.com/user/emails", {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          "User-Agent": "DebugDiary-App",
        },
      });
      const emails = (await emailsRes.json()) as Array<{
        primary?: boolean;
        verified?: boolean;
        email?: string;
      }>;
      const primaryEmail = Array.isArray(emails)
        ? emails.find((e) => e.primary && e.verified)?.email || emails[0]?.email
        : null;
      if (primaryEmail) email = primaryEmail;
      else email = `${ghUser.login || "dev"}@users.noreply.github.com`;
    }

    console.log("GitHub OAuth User Fetched:", {
      name,
      email,
      ghLogin: ghUser.login,
      ghEmail: ghUser.email,
    });

    const result = await findOrCreateGitHubUser({
      email,
      name,
      githubAccessToken: tokenData.access_token,
      githubUsername: ghUser.login || undefined,
    });
    const targetPath = returnTo.startsWith("/") ? returnTo : "/dashboard";
    res.redirect(
      `${env.FRONTEND_URL}${targetPath}?token=${result.accessToken}&provider=github&name=${encodeURIComponent(result.user.name)}&email=${encodeURIComponent(result.user.email)}`
    );
  } catch (err: unknown) {
    console.error("GitHub OAuth callback error:", err);
    res.redirect(
      `${env.FRONTEND_URL}/?error=${encodeURIComponent((err as Error).message)}`
    );
  }
});

export default router;
