import { prisma } from "../db/prisma";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { JwtPayload } from "../middleware/auth.middleware";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WorkspaceSummary {
  id: string;
  name: string;
  role: string;
  isCurrent: boolean;
  createdAt: Date;
  memberCount: number;
  repositoryCount: number;
  incidentCount: number;
}

export interface WorkspaceDetail {
  id: string;
  name: string;
  role: string;
  createdAt: Date;
  stats: {
    members: number;
    repositories: number;
    incidents: number;
  };
  members: Array<{
    userId: string;
    email: string;
    name: string;
    role: string;
  }>;
}

// ─── Helper: Sign Token with specific workspace ───────────────────────────────

function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}

// ─── List Workspaces ──────────────────────────────────────────────────────────

export async function listWorkspaces(
  userId: string,
  currentWorkspaceId?: string
): Promise<WorkspaceSummary[]> {
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
    include: {
      workspace: {
        include: {
          _count: {
            select: {
              members: true,
              repositories: true,
              incidents: true,
            },
          },
        },
      },
    },
    orderBy: { workspace: { createdAt: "asc" } },
  });

  return memberships.map((m) => ({
    id: m.workspace.id,
    name: m.workspace.name,
    role: m.role,
    isCurrent: m.workspace.id === currentWorkspaceId,
    createdAt: m.workspace.createdAt,
    memberCount: m.workspace._count.members,
    repositoryCount: m.workspace._count.repositories,
    incidentCount: m.workspace._count.incidents,
  }));
}

// ─── Get Workspace Detail ─────────────────────────────────────────────────────

export async function getWorkspace(
  workspaceId: string,
  userId: string
): Promise<WorkspaceDetail> {
  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });

  if (!membership) {
    throw new Error("You do not have access to this workspace");
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      _count: {
        select: {
          members: true,
          repositories: true,
          incidents: true,
        },
      },
      members: {
        include: { user: true },
        orderBy: { role: "asc" },
      },
    },
  });

  if (!workspace) {
    throw new Error("Workspace not found");
  }

  return {
    id: workspace.id,
    name: workspace.name,
    role: membership.role,
    createdAt: workspace.createdAt,
    stats: {
      members: workspace._count.members,
      repositories: workspace._count.repositories,
      incidents: workspace._count.incidents,
    },
    members: workspace.members.map((m) => ({
      userId: m.user.id,
      email: m.user.email,
      name: m.user.name,
      role: m.role,
    })),
  };
}

// ─── Create Workspace ─────────────────────────────────────────────────────────

export async function createWorkspace(
  userId: string,
  userEmail: string,
  name: string
) {
  if (!name.trim()) {
    throw new Error("Workspace name is required");
  }

  const workspace = await prisma.$transaction(async (tx) => {
    const ws = await tx.workspace.create({
      data: { name: name.trim() },
    });

    await tx.workspaceMember.create({
      data: {
        userId,
        workspaceId: ws.id,
        role: "OWNER",
      },
    });

    return ws;
  });

  const accessToken = signToken({
    userId,
    email: userEmail,
    workspaceId: workspace.id,
  });

  return {
    workspace: {
      id: workspace.id,
      name: workspace.name,
      role: "OWNER",
      createdAt: workspace.createdAt,
    },
    accessToken,
    token: accessToken,
  };
}

// ─── Update Workspace ─────────────────────────────────────────────────────────

export async function updateWorkspace(
  workspaceId: string,
  userId: string,
  data: { name?: string }
) {
  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });

  if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
    throw new Error("Only workspace owners or admins can update workspace settings");
  }

  if (data.name !== undefined && !data.name.trim()) {
    throw new Error("Workspace name cannot be empty");
  }

  const updated = await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      ...(data.name ? { name: data.name.trim() } : {}),
    },
  });

  return {
    id: updated.id,
    name: updated.name,
    role: membership.role,
  };
}

// ─── Delete Workspace ─────────────────────────────────────────────────────────

export async function deleteWorkspace(
  workspaceId: string,
  userId: string,
  userEmail: string
) {
  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });

  if (!membership || membership.role !== "OWNER") {
    throw new Error("Only the workspace owner can delete this workspace");
  }

  // Ensure user has at least one other workspace
  const userWorkspaces = await prisma.workspaceMember.findMany({
    where: { userId },
  });

  if (userWorkspaces.length <= 1) {
    throw new Error("Cannot delete your only workspace. Create another workspace first.");
  }

  // Delete workspace (cascade removes members, repos, incidents)
  await prisma.workspace.delete({
    where: { id: workspaceId },
  });

  // Pick remaining workspace
  const remaining = await prisma.workspaceMember.findFirst({
    where: { userId },
    orderBy: { workspace: { createdAt: "asc" } },
  });

  const nextWorkspaceId = remaining?.workspaceId ?? "";
  const accessToken = signToken({
    userId,
    email: userEmail,
    workspaceId: nextWorkspaceId,
  });

  return {
    success: true,
    deletedWorkspaceId: workspaceId,
    nextWorkspaceId,
    accessToken,
    token: accessToken,
  };
}

// ─── Switch Active Workspace ──────────────────────────────────────────────────

export async function switchWorkspace(
  targetWorkspaceId: string,
  userId: string,
  userEmail: string
) {
  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: targetWorkspaceId, userId } },
    include: { workspace: true },
  });

  if (!membership) {
    throw new Error("You do not have access to this workspace");
  }

  const accessToken = signToken({
    userId,
    email: userEmail,
    workspaceId: targetWorkspaceId,
  });

  return {
    workspace: {
      id: membership.workspace.id,
      name: membership.workspace.name,
      role: membership.role,
    },
    accessToken,
    token: accessToken,
  };
}

// ─── Member Management ────────────────────────────────────────────────────────

export async function addWorkspaceMember(
  workspaceId: string,
  currentUserId: string,
  email: string,
  role: string = "MEMBER"
) {
  const currentMembership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: currentUserId } },
  });

  if (!currentMembership || (currentMembership.role !== "OWNER" && currentMembership.role !== "ADMIN")) {
    throw new Error("Only workspace owners or admins can invite new members");
  }

  const targetUser = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  });

  if (!targetUser) {
    throw new Error(`User with email "${email}" not found. Ask them to create an account first.`);
  }

  const existingMember = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: targetUser.id } },
  });

  if (existingMember) {
    throw new Error("User is already a member of this workspace");
  }

  const newMember = await prisma.workspaceMember.create({
    data: {
      workspaceId,
      userId: targetUser.id,
      role,
    },
    include: { user: true },
  });

  return {
    userId: newMember.user.id,
    email: newMember.user.email,
    name: newMember.user.name,
    role: newMember.role,
  };
}

export async function removeWorkspaceMember(
  workspaceId: string,
  currentUserId: string,
  targetUserId: string
) {
  const currentMembership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: currentUserId } },
  });

  if (!currentMembership || (currentMembership.role !== "OWNER" && currentMembership.role !== "ADMIN")) {
    throw new Error("Only workspace owners or admins can remove members");
  }

  const targetMembership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
  });

  if (!targetMembership) {
    throw new Error("User is not a member of this workspace");
  }

  if (targetMembership.role === "OWNER") {
    throw new Error("Cannot remove the workspace owner");
  }

  await prisma.workspaceMember.delete({
    where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
  });

  return { success: true, removedUserId: targetUserId };
}
