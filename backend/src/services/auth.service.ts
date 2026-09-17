import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../db/prisma";
import { env } from "../config/env";
import { getInitials } from "../utils/format";

const SALT_ROUNDS = 12;

export interface JwtPayload {
  userId: string;
  email: string;
  workspaceId: string;
}

// ─── Register ─────────────────────────────────────────────────────────────────

export async function registerUser(
  email: string,
  password: string,
  name: string
) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error("An account with this email already exists");

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  // Create user + dedicated personal workspace
  const { user, workspace } = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email, passwordHash, name },
    });

    const workspace = await tx.workspace.create({
      data: {
        name: `${name}'s Workspace`,
      },
    });

    await tx.workspaceMember.create({
      data: {
        userId: user.id,
        workspaceId: workspace.id,
        role: "OWNER",
      },
    });

    return { user, workspace };
  });

  const accessToken = signToken({
    userId: user.id,
    email: user.email,
    workspaceId: workspace.id,
  });

  return {
    accessToken,
    token: accessToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      initials: getInitials(user.name),
      department: "Engineering",
    },
  };
}

// ─── Login ────────────────────────────────────────────────────────────────────

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("Invalid email or password");

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new Error("Invalid email or password");

  // Fetch user's own workspace (priority to OWNER, then any membership)
  let membership = await prisma.workspaceMember.findFirst({
    where: { userId: user.id, role: "OWNER" },
    orderBy: { workspace: { createdAt: "asc" } },
  });

  if (!membership) {
    membership = await prisma.workspaceMember.findFirst({
      where: { userId: user.id },
      orderBy: { workspace: { createdAt: "asc" } },
    });
  }

  let workspaceId = membership?.workspaceId;
  if (!workspaceId) {
    const newWs = await prisma.workspace.create({
      data: {
        name: `${user.name}'s Workspace`,
        members: {
          create: {
            userId: user.id,
            role: "OWNER",
          },
        },
      },
    });
    workspaceId = newWs.id;
  }

  const accessToken = signToken({
    userId: user.id,
    email: user.email,
    workspaceId,
  });

  return {
    accessToken,
    token: accessToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      initials: getInitials(user.name),
      department: "Engineering",
    },
  };
}

// ─── Get Current User ─────────────────────────────────────────────────────────

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    githubUsername: user.githubUsername,
    hasGithub: !!user.githubAccessToken,
    initials: getInitials(user.name),
    department: "Engineering",
    createdAt: user.createdAt,
  };
}

// ─── GitHub OAuth User ───────────────────────────────────────────────────────

export async function findOrCreateGitHubUser(data: {
  email: string;
  name: string;
  githubAccessToken?: string;
  githubUsername?: string;
}) {
  let user = await prisma.user.findUnique({ where: { email: data.email } });
  let workspaceId = "";

  if (!user) {
    const passwordHash = await bcrypt.hash("github_oauth_" + Math.random(), SALT_ROUNDS);
    const result = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: data.email,
          name: data.name || "GitHub Developer",
          passwordHash,
          githubAccessToken: data.githubAccessToken || null,
          githubUsername: data.githubUsername || null,
        },
      });

      const ws = await tx.workspace.create({
        data: { name: `${newUser.name}'s Workspace` },
      });

      await tx.workspaceMember.create({
        data: {
          userId: newUser.id,
          workspaceId: ws.id,
          role: "OWNER",
        },
      });

      return { user: newUser, workspaceId: ws.id };
    });
    user = result.user;
    workspaceId = result.workspaceId;
  } else {
    // Update existing user with latest GitHub access token and username
    if (data.githubAccessToken || data.githubUsername) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          ...(data.githubAccessToken ? { githubAccessToken: data.githubAccessToken } : {}),
          ...(data.githubUsername ? { githubUsername: data.githubUsername } : {}),
        },
      });
    }

    let membership = await prisma.workspaceMember.findFirst({
      where: { userId: user.id, role: "OWNER" },
      orderBy: { workspace: { createdAt: "asc" } },
    });
    if (!membership) {
      membership = await prisma.workspaceMember.findFirst({
        where: { userId: user.id },
        orderBy: { workspace: { createdAt: "asc" } },
      });
    }
    if (!membership) {
      const newWs = await prisma.workspace.create({
        data: {
          name: `${user.name}'s Workspace`,
          members: {
            create: {
              userId: user.id,
              role: "OWNER",
            },
          },
        },
      });
      workspaceId = newWs.id;
    } else {
      workspaceId = membership.workspaceId;
    }
  }

  const accessToken = signToken({
    userId: user.id,
    email: user.email,
    workspaceId,
  });

  return {
    accessToken,
    token: accessToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      githubUsername: user.githubUsername,
      hasGithub: !!user.githubAccessToken,
      initials: getInitials(user.name),
      department: "Engineering",
    },
  };
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}

