import crypto from 'node:crypto';
import type { Request } from 'express';
import jwt from 'jsonwebtoken';
import AdminAuditLog from '../models/AdminAuditLog.model.js';
import AdminSession from '../models/AdminSession.model.js';
import type { IUser, UserPermission } from '../models/User.model.js';
import { DEFAULT_ROLE_PERMISSIONS, SYSTEM_USER_ROLES } from '../models/User.model.js';

const ROLE_HIERARCHY: Record<string, number> = {
  super_admin: 100,
  admin: 90,
  manager: 80,
  finance_manager: 70,
  donations_manager: 70,
  content_manager: 70,
  campaign_manager: 70,
  content_editor: 60,
  editor: 60,
  reviewer: 50,
  support_manager: 50,
  beneficiary_manager: 50,
  benefactor: 10,
  user: 0,
};

const getRoleWeight = (role: string) => ROLE_HIERARCHY[role] ?? 20;

export const isSystemRole = (role: string) => SYSTEM_USER_ROLES.includes(role as (typeof SYSTEM_USER_ROLES)[number]);

export const canAssignRole = (actor: IUser, role: string) => {
  if (actor.role === 'super_admin') {
    return true;
  }

  if (role === 'super_admin') {
    return false;
  }

  return getRoleWeight(actor.role) > getRoleWeight(role);
};

export const canManageUser = (actor: IUser, target: IUser) => {
  if (String(actor._id) === String(target._id)) {
    return true;
  }

  return getRoleWeight(actor.role) > getRoleWeight(target.role);
};

export const getAssignablePermissions = (actor: IUser): UserPermission[] => {
  const permissions = typeof actor.getEffectivePermissions === 'function'
    ? actor.getEffectivePermissions()
    : [...new Set([...(DEFAULT_ROLE_PERMISSIONS[actor.role] ?? []), ...(actor.permissions ?? [])])];

  if (permissions.includes('*')) {
    return ['*'];
  }

  return permissions.filter((permission): permission is UserPermission => permission !== '*');
};

export const filterAssignablePermissions = (actor: IUser, requestedPermissions: string[] = []) => {
  const assignablePermissions = getAssignablePermissions(actor);

  if (assignablePermissions.includes('*')) {
    return [...new Set(requestedPermissions)] as UserPermission[];
  }

  return [...new Set(requestedPermissions.filter((permission) => assignablePermissions.includes(permission as UserPermission)))] as UserPermission[];
};

export const createAdminSession = async (req: Request, userId: string) => {
  const refreshTokenId = crypto.randomUUID();
  const session = await AdminSession.create({
    user: userId,
    refreshTokenId,
    ipAddress: req.ip,
    userAgent: req.get('user-agent') ?? '',
    lastActivityAt: new Date(),
  });

  return session;
};

export const serializeSession = (session: {
  _id: unknown;
  userAgent?: string;
  ipAddress?: string;
  createdAt?: Date;
  updatedAt?: Date;
  lastActivityAt?: Date;
}) => ({
  _id: String(session._id),
  device: session.userAgent || 'Navigateur inconnu',
  browser: session.userAgent || 'Navigateur inconnu',
  ipAddress: session.ipAddress || 'Inconnue',
  createdAt: session.createdAt,
  lastActivityAt: session.lastActivityAt ?? session.updatedAt,
});

export const getCurrentSessionIdFromRequest = (req: Request) => {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    return null;
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET as string) as { sessionId?: string };
    return decoded.sessionId ?? null;
  } catch {
    return null;
  }
};

export const auditAdminAction = async ({
  actor,
  action,
  targetUser,
  previousValues,
  newValues,
  req,
}: {
  actor?: IUser | null;
  action: string;
  targetUser?: string | null;
  previousValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  req?: Request;
}) => {
  await AdminAuditLog.create({
    actor: actor?._id ?? null,
    action,
    targetUser: targetUser ?? null,
    previousValues: previousValues ?? null,
    newValues: newValues ?? null,
    ipAddress: req?.ip ?? '',
    userAgent: req?.get('user-agent') ?? '',
  });
};
