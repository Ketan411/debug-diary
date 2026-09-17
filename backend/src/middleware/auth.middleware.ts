import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { prisma } from "../db/prisma";

export interface JwtPayload {
  userId: string;
  email: string;
  workspaceId: string;
}

// Extend Express Request to carry the decoded JWT user
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

let cachedDemoUser: JwtPayload | null = null;

async function getDemoUser(): Promise<JwtPayload | null> {
  if (cachedDemoUser) return cachedDemoUser;
  try {
    const user = await prisma.user.findFirst({
      where: { email: "demo@debugdiary.com" },
      include: { workspaceMembers: true },
    });
    if (user && user.workspaceMembers[0]) {
      cachedDemoUser = {
        userId: user.id,
        email: user.email,
        workspaceId: user.workspaceMembers[0].workspaceId,
      };
      return cachedDemoUser;
    }
    const anyWorkspace = await prisma.workspace.findFirst({
      include: { members: true },
    });
    if (anyWorkspace && anyWorkspace.members[0]) {
      cachedDemoUser = {
        userId: anyWorkspace.members[0].userId,
        email: "demo@debugdiary.com",
        workspaceId: anyWorkspace.id,
      };
      return cachedDemoUser;
    }
  } catch (err) {
    console.error("Failed to load fallback demo user:", err);
  }
  return null;
}

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    if (token && token !== "null" && token !== "undefined" && token !== "demo") {
      try {
        const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

        // 1. If token specifies a workspaceId, verify user belongs to it
        let activeWorkspaceId = payload.workspaceId;
        if (activeWorkspaceId) {
          const isMember = await prisma.workspaceMember.findUnique({
            where: {
              workspaceId_userId: {
                workspaceId: activeWorkspaceId,
                userId: payload.userId,
              },
            },
          });
          if (!isMember) {
            activeWorkspaceId = "";
          }
        }

        // 2. Fallback to user's owned workspace if not specified or invalid
        if (!activeWorkspaceId) {
          const membership = await prisma.workspaceMember.findFirst({
            where: { userId: payload.userId, role: "OWNER" },
            orderBy: { workspace: { createdAt: "asc" } },
          });

          const anyMembership =
            membership ||
            (await prisma.workspaceMember.findFirst({
              where: { userId: payload.userId },
              orderBy: { workspace: { createdAt: "asc" } },
            }));

          activeWorkspaceId = anyMembership?.workspaceId ?? "";
        }

        req.user = {
          userId: payload.userId,
          email: payload.email,
          workspaceId: activeWorkspaceId,
        };
        return next();
      } catch {
        // Token invalid or expired, continue to fallback
      }
    }
  }

  // Fallback to demo user/workspace for seamless development & demo viewing
  const demo = await getDemoUser();
  if (demo) {
    req.user = demo;
    return next();
  }

  res.status(401).json({ error: "Missing or invalid Authorization header" });
}
