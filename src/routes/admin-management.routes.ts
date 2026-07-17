import express from 'express';
import { z } from 'zod';
import User, { AVAILABLE_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } from '../models/User.model.js';
import Role from '../models/Role.model.js';
import AdminInvitation, { createInvitationToken } from '../models/AdminInvitation.model.js';
import AdminSession from '../models/AdminSession.model.js';
import AdminAuditLog from '../models/AdminAuditLog.model.js';
import { AuthRequest, authorizePermissions, protect } from '../middleware/auth.middleware.js';
import {
  auditAdminAction,
  canAssignRole,
  canManageUser,
  filterAssignablePermissions,
  isSystemRole,
  serializeSession,
} from '../utils/admin-security.js';

const router = express.Router();

const baseAdministratorSchema = z.object({
  firstName: z.string().trim().min(1, 'Le prénom est requis'),
  lastName: z.string().trim().min(1, 'Le nom est requis'),
  email: z.string().trim().email("L'adresse email est invalide"),
  phone: z.string().trim().max(40).optional().or(z.literal('')),
  role: z.string().trim().min(1, 'Le rôle est requis'),
  permissions: z.array(z.enum(AVAILABLE_PERMISSIONS)).default([]),
  isActive: z.boolean().default(true),
  isVerified: z.boolean().default(true),
  preferredLanguage: z.string().trim().min(2).max(10).default('fr'),
  timezone: z.string().trim().min(2).max(100).default('America/Port-au-Prince'),
});

const createAdministratorSchema = baseAdministratorSchema.extend({
  passwordMode: z.enum(['temporary_password', 'set_password_now', 'invitation']).default('temporary_password'),
  password: z.string().min(10).optional(),
});

const updateAdministratorSchema = baseAdministratorSchema.partial().extend({
  permissions: z.array(z.enum(AVAILABLE_PERMISSIONS)).optional(),
});

const statusSchema = z.object({
  isActive: z.boolean(),
  reason: z.string().trim().max(300).optional().or(z.literal('')),
});

const roleSchema = z.object({
  name: z.string().trim().min(1, 'Le nom est requis'),
  code: z
    .string()
    .trim()
    .min(2, 'Le code est requis')
    .max(80)
    .regex(/^[a-z0-9_]+$/, 'Le code doit contenir uniquement des lettres minuscules, chiffres et underscores'),
  description: z.string().trim().max(500).optional().or(z.literal('')),
  permissions: z.array(z.enum(AVAILABLE_PERMISSIONS)).default([]),
  isActive: z.boolean().default(true),
});

const invitationSchema = z.object({
  email: z.string().trim().email("L'adresse email est invalide"),
  firstName: z.string().trim().min(1, 'Le prénom est requis'),
  lastName: z.string().trim().min(1, 'Le nom est requis'),
  role: z.string().trim().min(1, 'Le rôle est requis'),
  permissions: z.array(z.enum(AVAILABLE_PERMISSIONS)).default([]),
  preferredLanguage: z.string().trim().min(2).max(10).default('fr'),
  timezone: z.string().trim().min(2).max(100).default('America/Port-au-Prince'),
});

const acceptInvitationSchema = z.object({
  token: z.string().min(10, "Le jeton d'invitation est invalide"),
  password: z
    .string()
    .min(10, 'Le mot de passe doit contenir au moins 10 caractères')
    .regex(/[A-Z]/, 'Le mot de passe doit contenir une majuscule')
    .regex(/[a-z]/, 'Le mot de passe doit contenir une minuscule')
    .regex(/[0-9]/, 'Le mot de passe doit contenir un chiffre')
    .regex(/[^A-Za-z0-9]/, 'Le mot de passe doit contenir un caractère spécial'),
});

const serializeUser = (user: any) => ({
  _id: String(user._id),
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  phone: user.phone ?? '',
  avatarUrl: user.avatarUrl ?? null,
  role: user.role,
  permissions: typeof user.getEffectivePermissions === 'function' ? user.getEffectivePermissions() : user.permissions ?? [],
  isVerified: user.isVerified,
  isActive: user.isActive,
  preferredLanguage: user.preferredLanguage ?? 'fr',
  timezone: user.timezone ?? 'America/Port-au-Prince',
  createdBy: user.createdBy ?? null,
  updatedBy: user.updatedBy ?? null,
  lastLoginAt: user.lastLoginAt ?? null,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  deletedAt: user.deletedAt ?? null,
});

const serializeRole = (role: any) => ({
  _id: String(role._id),
  name: role.name,
  code: role.code,
  description: role.description ?? '',
  permissions: role.permissions ?? [],
  isSystem: role.isSystem ?? false,
  isActive: role.isActive ?? true,
  createdAt: role.createdAt,
  updatedAt: role.updatedAt,
});

const serializeInvitation = (invitation: any) => ({
  _id: String(invitation._id),
  email: invitation.email,
  firstName: invitation.firstName,
  lastName: invitation.lastName,
  role: invitation.role,
  permissions: invitation.permissions ?? [],
  status: invitation.status,
  expiresAt: invitation.expiresAt,
  acceptedAt: invitation.acceptedAt ?? null,
  createdAt: invitation.createdAt,
  updatedAt: invitation.updatedAt,
});

const getRolePermissions = async (roleCode: string) => {
  const systemPermissions = DEFAULT_ROLE_PERMISSIONS[roleCode];

  if (systemPermissions) {
    return [...systemPermissions];
  }

  const role = await Role.findOne({ code: roleCode, isActive: true });
  return role?.permissions ?? [];
};

const ensureRoleCanBeAssigned = async (actor: NonNullable<AuthRequest['user']>, role: string) => {
  if (isSystemRole(role)) {
    return canAssignRole(actor, role);
  }

  return actor.role === 'super_admin';
};

const getLastSuperAdminCount = () =>
  User.countDocuments({
    role: 'super_admin',
    isActive: true,
    deletedAt: null,
  });

router.get('/permissions', protect, authorizePermissions('roles.read', 'admins.assign_permissions'), async (req: AuthRequest, res) => {
  const permissions = filterAssignablePermissions(req.user!, [...AVAILABLE_PERMISSIONS]);
  return res.json({ items: permissions });
});

router.get('/roles', protect, authorizePermissions('roles.read', 'admins.read'), async (_req: AuthRequest, res) => {
  const systemRoles = Object.entries(DEFAULT_ROLE_PERMISSIONS).map(([code, permissions]) => ({
    _id: `system:${code}`,
    name: code,
    code,
    description: 'Rôle système',
    permissions,
    isSystem: true,
    isActive: true,
  }));

  const customRoles = await Role.find().sort({ isSystem: -1, name: 1 });
  return res.json({
    items: [...systemRoles, ...customRoles.map(serializeRole)],
  });
});

router.get('/roles/:id', protect, authorizePermissions('roles.read', 'admins.read'), async (req: AuthRequest, res) => {
  if (req.params.id.startsWith('system:')) {
    const code = req.params.id.replace('system:', '');
    const permissions = DEFAULT_ROLE_PERMISSIONS[code];

    if (!permissions) {
      return res.status(404).json({ message: 'Rôle introuvable' });
    }

    return res.json({
      role: {
        _id: req.params.id,
        name: code,
        code,
        description: 'Rôle système',
        permissions,
        isSystem: true,
        isActive: true,
      },
    });
  }

  const role = await Role.findById(req.params.id);
  if (!role) {
    return res.status(404).json({ message: 'Rôle introuvable' });
  }

  return res.json({ role: serializeRole(role) });
});

router.post('/roles', protect, authorizePermissions('roles.create'), async (req: AuthRequest, res) => {
  try {
    const payload = roleSchema.parse(req.body);

    if (isSystemRole(payload.code)) {
      return res.status(400).json({ message: 'Ce code est réservé à un rôle système' });
    }

    const existingRole = await Role.findOne({ code: payload.code });
    if (existingRole) {
      return res.status(400).json({ message: 'Un rôle avec ce code existe déjà' });
    }

    const filteredPermissions = filterAssignablePermissions(req.user!, payload.permissions);

    const role = await Role.create({
      ...payload,
      permissions: filteredPermissions,
      createdBy: req.user?._id ?? null,
      updatedBy: req.user?._id ?? null,
    });

    await auditAdminAction({
      actor: req.user,
      action: 'ADMIN_ROLE_CREATED',
      newValues: { code: role.code, permissions: role.permissions },
      req,
    });

    return res.status(201).json({
      message: 'Rôle créé avec succès',
      role: serializeRole(role),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.issues[0]?.message ?? 'Données invalides' });
    }

    return res.status(400).json({ message: 'Impossible de créer ce rôle', error });
  }
});

router.patch('/roles/:id', protect, authorizePermissions('roles.update'), async (req: AuthRequest, res) => {
  try {
    const payload = roleSchema.partial().parse(req.body);
    const role = await Role.findById(req.params.id);

    if (!role) {
      return res.status(404).json({ message: 'Rôle introuvable' });
    }

    if (role.isSystem) {
      return res.status(403).json({ message: 'Les rôles système ne peuvent pas être modifiés ici' });
    }

    const previousValues = serializeRole(role);

    if (payload.name !== undefined) {
      role.name = payload.name;
    }
    if (payload.description !== undefined) {
      role.description = payload.description;
    }
    if (payload.permissions !== undefined) {
      role.permissions = filterAssignablePermissions(req.user!, payload.permissions);
    }
    if (payload.isActive !== undefined) {
      role.isActive = payload.isActive;
    }
    role.updatedBy = req.user?._id ?? null;
    await role.save();

    await auditAdminAction({
      actor: req.user,
      action: 'ADMIN_ROLE_UPDATED',
      previousValues,
      newValues: serializeRole(role),
      req,
    });

    return res.json({ message: 'Rôle mis à jour avec succès', role: serializeRole(role) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.issues[0]?.message ?? 'Données invalides' });
    }

    return res.status(400).json({ message: 'Impossible de mettre à jour ce rôle', error });
  }
});

router.delete('/roles/:id', protect, authorizePermissions('roles.delete'), async (req: AuthRequest, res) => {
  const role = await Role.findById(req.params.id);

  if (!role) {
    return res.status(404).json({ message: 'Rôle introuvable' });
  }

  if (role.isSystem) {
    return res.status(403).json({ message: 'Un rôle système ne peut pas être supprimé' });
  }

  await role.deleteOne();

  await auditAdminAction({
    actor: req.user,
    action: 'ADMIN_ROLE_DELETED',
    previousValues: serializeRole(role),
    req,
  });

  return res.json({ message: 'Rôle supprimé avec succès' });
});

router.get('/admins', protect, authorizePermissions('admins.read', 'staff.manage'), async (req: AuthRequest, res) => {
  const users = await User.find({ deletedAt: null }).sort({ createdAt: -1 }).select('-password');
  const filtered = users.filter((user) => canManageUser(req.user!, user) || String(user._id) === String(req.user?._id));
  return res.json({ items: filtered.map(serializeUser) });
});

router.get('/admins/:id', protect, authorizePermissions('admins.read', 'staff.manage'), async (req: AuthRequest, res) => {
  const user = await User.findById(req.params.id).select('-password');

  if (!user || user.deletedAt) {
    return res.status(404).json({ message: 'Administrateur introuvable' });
  }

  if (!canManageUser(req.user!, user) && String(user._id) !== String(req.user?._id)) {
    return res.status(403).json({ message: 'Vous ne pouvez pas consulter ce compte' });
  }

  const sessions = await AdminSession.find({
    user: user._id,
    revokedAt: null,
  }).sort({ lastActivityAt: -1 });

  const recentAudit = await AdminAuditLog.find({
    $or: [{ targetUser: user._id }, { actor: user._id }],
  })
    .sort({ createdAt: -1 })
    .limit(20);

  return res.json({
    administrator: serializeUser(user),
    sessions: sessions.map(serializeSession),
    recentAudit: recentAudit.map((item) => ({
      _id: String(item._id),
      action: item.action,
      createdAt: item.createdAt,
      previousValues: item.previousValues ?? null,
      newValues: item.newValues ?? null,
    })),
  });
});

router.post('/admins', protect, authorizePermissions('admins.create', 'staff.manage'), async (req: AuthRequest, res) => {
  try {
    const payload = createAdministratorSchema.parse(req.body);
    const canAssign = await ensureRoleCanBeAssigned(req.user!, payload.role);

    if (!canAssign) {
      return res.status(403).json({ message: "Vous ne pouvez pas attribuer ce rôle" });
    }

    const existingUser = await User.findOne({ email: payload.email });
    if (existingUser) {
      return res.status(400).json({ message: 'Cette adresse email est déjà utilisée' });
    }

    const rolePermissions = await getRolePermissions(payload.role);
    const extraPermissions = filterAssignablePermissions(req.user!, payload.permissions);
    const password =
      payload.passwordMode === 'invitation'
        ? `Temp-${Math.random().toString(36).slice(2)}A!9`
        : payload.password || `Temp-${Math.random().toString(36).slice(2)}A!9`;

    const user = await User.create({
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
      phone: payload.phone ?? '',
      password,
      role: payload.role,
      permissions: [...new Set([...(rolePermissions ?? []), ...extraPermissions])],
      isActive: payload.isActive,
      isVerified: payload.isVerified,
      mustChangePassword: payload.passwordMode !== 'set_password_now',
      preferredLanguage: payload.preferredLanguage,
      timezone: payload.timezone,
      createdBy: req.user?._id ?? null,
      updatedBy: req.user?._id ?? null,
    });

    let invitation: any = null;

    if (payload.passwordMode === 'invitation') {
      const { token, tokenHash } = createInvitationToken();
      invitation = await AdminInvitation.create({
        email: payload.email,
        firstName: payload.firstName,
        lastName: payload.lastName,
        role: payload.role,
        permissions: extraPermissions,
        tokenHash,
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        status: 'pending',
        invitedBy: req.user?._id ?? null,
      });

      invitation = {
        ...serializeInvitation(invitation),
        activationLink: `${req.protocol}://${req.get('host')}/admin/invitations/accept?token=${token}`,
      };
    }

    await auditAdminAction({
      actor: req.user,
      action: 'ADMIN_ACCOUNT_CREATED',
      targetUser: String(user._id),
      newValues: {
        role: user.role,
        permissions: user.permissions,
        passwordMode: payload.passwordMode,
      },
      req,
    });

    return res.status(201).json({
      message: 'Compte administrateur créé avec succès',
      administrator: serializeUser(user),
      invitation,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.issues[0]?.message ?? 'Données invalides' });
    }

    return res.status(400).json({ message: 'Impossible de créer ce compte administrateur', error });
  }
});

router.patch('/admins/:id', protect, authorizePermissions('admins.update', 'staff.manage'), async (req: AuthRequest, res) => {
  try {
    const payload = updateAdministratorSchema.parse(req.body);
    const user = await User.findById(req.params.id).select('-password');

    if (!user || user.deletedAt) {
      return res.status(404).json({ message: 'Administrateur introuvable' });
    }

    if (!canManageUser(req.user!, user) && String(user._id) !== String(req.user?._id)) {
      return res.status(403).json({ message: 'Vous ne pouvez pas modifier ce compte' });
    }

    const previousValues = serializeUser(user);

    if (payload.role !== undefined) {
      const canAssign = await ensureRoleCanBeAssigned(req.user!, payload.role);
      if (!canAssign) {
        return res.status(403).json({ message: "Vous ne pouvez pas attribuer ce rôle" });
      }
      user.role = payload.role;
      const rolePermissions = await getRolePermissions(payload.role);
      user.permissions = [...new Set([...(rolePermissions ?? []), ...filterAssignablePermissions(req.user!, payload.permissions ?? [])])];
    } else if (payload.permissions !== undefined) {
      user.permissions = filterAssignablePermissions(req.user!, payload.permissions);
    }

    if (payload.firstName !== undefined) user.firstName = payload.firstName;
    if (payload.lastName !== undefined) user.lastName = payload.lastName;
    if (payload.phone !== undefined) user.phone = payload.phone ?? '';
    if (payload.email !== undefined) user.email = payload.email;
    if (payload.isActive !== undefined) user.isActive = payload.isActive;
    if (payload.isVerified !== undefined) user.isVerified = payload.isVerified;
    if (payload.preferredLanguage !== undefined) user.preferredLanguage = payload.preferredLanguage;
    if (payload.timezone !== undefined) user.timezone = payload.timezone;
    user.updatedBy = req.user?._id ?? null;
    await user.save();

    await auditAdminAction({
      actor: req.user,
      action: 'ADMIN_ACCOUNT_UPDATED',
      targetUser: String(user._id),
      previousValues,
      newValues: serializeUser(user),
      req,
    });

    return res.json({
      message: 'Compte administrateur mis à jour avec succès',
      administrator: serializeUser(user),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.issues[0]?.message ?? 'Données invalides' });
    }

    return res.status(400).json({ message: 'Impossible de mettre à jour ce compte', error });
  }
});

router.patch('/admins/:id/role', protect, authorizePermissions('admins.assign_roles'), async (req: AuthRequest, res) => {
  try {
    const payload = z
      .object({
        role: z.string().trim().min(1, 'Le rôle est requis'),
        permissions: z.array(z.enum(AVAILABLE_PERMISSIONS)).optional(),
      })
      .parse(req.body);

    const user = await User.findById(req.params.id).select('-password');

    if (!user || user.deletedAt) {
      return res.status(404).json({ message: 'Administrateur introuvable' });
    }

    if (!canManageUser(req.user!, user)) {
      return res.status(403).json({ message: 'Vous ne pouvez pas modifier ce compte' });
    }

    const canAssign = await ensureRoleCanBeAssigned(req.user!, payload.role);
    if (!canAssign) {
      return res.status(403).json({ message: "Vous ne pouvez pas attribuer ce rôle" });
    }

    const previousValues = serializeUser(user);
    const rolePermissions = await getRolePermissions(payload.role);
    user.role = payload.role;
    user.permissions = [
      ...new Set([...(rolePermissions ?? []), ...filterAssignablePermissions(req.user!, payload.permissions ?? [])]),
    ];
    user.updatedBy = req.user?._id ?? null;
    await user.save();

    await auditAdminAction({
      actor: req.user,
      action: 'ADMIN_ACCOUNT_ROLE_UPDATED',
      targetUser: String(user._id),
      previousValues,
      newValues: { role: user.role, permissions: user.permissions },
      req,
    });

    return res.json({
      message: 'Rôle administrateur mis à jour avec succès',
      administrator: serializeUser(user),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.issues[0]?.message ?? 'Données invalides' });
    }

    return res.status(400).json({ message: 'Impossible de modifier le rôle', error });
  }
});

router.patch('/admins/:id/permissions', protect, authorizePermissions('admins.assign_permissions'), async (req: AuthRequest, res) => {
  try {
    const payload = z
      .object({
        permissions: z.array(z.enum(AVAILABLE_PERMISSIONS)).default([]),
      })
      .parse(req.body);

    const user = await User.findById(req.params.id).select('-password');

    if (!user || user.deletedAt) {
      return res.status(404).json({ message: 'Administrateur introuvable' });
    }

    if (!canManageUser(req.user!, user)) {
      return res.status(403).json({ message: 'Vous ne pouvez pas modifier ce compte' });
    }

    const previousValues = serializeUser(user);
    user.permissions = filterAssignablePermissions(req.user!, payload.permissions);
    user.updatedBy = req.user?._id ?? null;
    await user.save();

    await auditAdminAction({
      actor: req.user,
      action: 'ADMIN_ACCOUNT_PERMISSIONS_UPDATED',
      targetUser: String(user._id),
      previousValues,
      newValues: { permissions: user.permissions },
      req,
    });

    return res.json({
      message: 'Permissions administrateur mises à jour avec succès',
      administrator: serializeUser(user),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.issues[0]?.message ?? 'Données invalides' });
    }

    return res.status(400).json({ message: 'Impossible de modifier les permissions', error });
  }
});

router.patch('/admins/:id/status', protect, authorizePermissions('admins.disable'), async (req: AuthRequest, res) => {
  try {
    const payload = statusSchema.parse(req.body);
    const user = await User.findById(req.params.id).select('-password');

    if (!user || user.deletedAt) {
      return res.status(404).json({ message: 'Administrateur introuvable' });
    }

    if (!canManageUser(req.user!, user)) {
      return res.status(403).json({ message: 'Vous ne pouvez pas modifier ce compte' });
    }

    if (user.role === 'super_admin' && payload.isActive === false) {
      const totalActiveSuperAdmins = await getLastSuperAdminCount();
      if (totalActiveSuperAdmins <= 1) {
        return res.status(400).json({ message: 'Impossible de désactiver le dernier super administrateur actif' });
      }
    }

    user.isActive = payload.isActive;
    user.updatedBy = req.user?._id ?? null;
    await user.save();

    if (!payload.isActive) {
      await AdminSession.updateMany(
        { user: user._id, revokedAt: null },
        { $set: { revokedAt: new Date() } }
      );
    }

    await auditAdminAction({
      actor: req.user,
      action: payload.isActive ? 'ADMIN_ACCOUNT_ENABLED' : 'ADMIN_ACCOUNT_DISABLED',
      targetUser: String(user._id),
      previousValues: { isActive: !payload.isActive },
      newValues: { isActive: payload.isActive, reason: payload.reason ?? '' },
      req,
    });

    return res.json({
      message: payload.isActive ? 'Compte activé avec succès' : 'Compte désactivé avec succès',
      administrator: serializeUser(user),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.issues[0]?.message ?? 'Données invalides' });
    }

    return res.status(400).json({ message: 'Impossible de modifier le statut du compte', error });
  }
});

router.post('/admins/:id/send-password-reset', protect, authorizePermissions('admins.update'), async (req: AuthRequest, res) => {
  const user = await User.findById(req.params.id).select('-password');

  if (!user || user.deletedAt) {
    return res.status(404).json({ message: 'Administrateur introuvable' });
  }

  if (!canManageUser(req.user!, user)) {
    return res.status(403).json({ message: 'Vous ne pouvez pas modifier ce compte' });
  }

  user.mustChangePassword = true;
  user.updatedBy = req.user?._id ?? null;
  await user.save();

  await auditAdminAction({
    actor: req.user,
    action: 'ADMIN_PASSWORD_RESET_SENT',
    targetUser: String(user._id),
    req,
  });

  return res.json({
    message: 'Le compte devra redéfinir son mot de passe à la prochaine connexion',
  });
});

router.post('/admins/:id/revoke-sessions', protect, authorizePermissions('admins.revoke_sessions', 'staff.manage'), async (req: AuthRequest, res) => {
  const user = await User.findById(req.params.id).select('-password');

  if (!user || user.deletedAt) {
    return res.status(404).json({ message: 'Administrateur introuvable' });
  }

  if (!canManageUser(req.user!, user)) {
    return res.status(403).json({ message: 'Vous ne pouvez pas modifier ce compte' });
  }

  await AdminSession.updateMany(
    {
      user: user._id,
      revokedAt: null,
    },
    { $set: { revokedAt: new Date() } }
  );

  await auditAdminAction({
    actor: req.user,
    action: 'ADMIN_ACCOUNT_SESSIONS_REVOKED',
    targetUser: String(user._id),
    req,
  });

  return res.json({ message: 'Les sessions du compte ont été révoquées' });
});

router.delete('/admins/:id', protect, authorizePermissions('admins.delete'), async (req: AuthRequest, res) => {
  const user = await User.findById(req.params.id).select('-password');

  if (!user || user.deletedAt) {
    return res.status(404).json({ message: 'Administrateur introuvable' });
  }

  if (!canManageUser(req.user!, user)) {
    return res.status(403).json({ message: 'Vous ne pouvez pas supprimer ce compte' });
  }

  if (String(user._id) === String(req.user?._id)) {
    const totalActiveSuperAdmins = await getLastSuperAdminCount();
    if (user.role === 'super_admin' && totalActiveSuperAdmins <= 1) {
      return res.status(400).json({ message: 'Impossible de supprimer le dernier super administrateur actif' });
    }
  }

  if (user.role === 'super_admin') {
    const totalActiveSuperAdmins = await getLastSuperAdminCount();
    if (totalActiveSuperAdmins <= 1) {
      return res.status(400).json({ message: 'Impossible de supprimer le dernier super administrateur actif' });
    }
  }

  user.deletedAt = new Date();
  user.deletedBy = req.user?._id ?? null;
  user.deletionReason = 'Archivage administratif';
  user.isActive = false;
  await user.save();

  await AdminSession.updateMany(
    {
      user: user._id,
      revokedAt: null,
    },
    { $set: { revokedAt: new Date() } }
  );

  await auditAdminAction({
    actor: req.user,
    action: 'ADMIN_ACCOUNT_ARCHIVED',
    targetUser: String(user._id),
    previousValues: serializeUser(user),
    req,
  });

  return res.json({ message: 'Compte administrateur archivé avec succès' });
});

router.get('/admin-invitations', protect, authorizePermissions('admins.read', 'admins.create'), async (_req: AuthRequest, res) => {
  const invitations = await AdminInvitation.find().sort({ createdAt: -1 });
  return res.json({ items: invitations.map(serializeInvitation) });
});

router.post('/admin-invitations', protect, authorizePermissions('admins.create'), async (req: AuthRequest, res) => {
  try {
    const payload = invitationSchema.parse(req.body);
    const canAssign = await ensureRoleCanBeAssigned(req.user!, payload.role);

    if (!canAssign) {
      return res.status(403).json({ message: "Vous ne pouvez pas attribuer ce rôle" });
    }

    const { token, tokenHash } = createInvitationToken();
    const invitation = await AdminInvitation.create({
      email: payload.email,
      firstName: payload.firstName,
      lastName: payload.lastName,
      role: payload.role,
      permissions: filterAssignablePermissions(req.user!, payload.permissions),
      tokenHash,
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      status: 'pending',
      invitedBy: req.user?._id ?? null,
    });

    await auditAdminAction({
      actor: req.user,
      action: 'ADMIN_INVITATION_CREATED',
      newValues: { email: payload.email, role: payload.role },
      req,
    });

    return res.status(201).json({
      message: 'Invitation créée avec succès',
      invitation: {
        ...serializeInvitation(invitation),
        activationLink: `${req.protocol}://${req.get('host')}/admin/invitations/accept?token=${token}`,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.issues[0]?.message ?? 'Données invalides' });
    }

    return res.status(400).json({ message: "Impossible de créer l'invitation", error });
  }
});

router.post('/admin-invitations/:id/resend', protect, authorizePermissions('admins.create'), async (req: AuthRequest, res) => {
  const invitation = await AdminInvitation.findById(req.params.id);

  if (!invitation) {
    return res.status(404).json({ message: 'Invitation introuvable' });
  }

  const { token, tokenHash } = createInvitationToken();
  invitation.tokenHash = tokenHash;
  invitation.expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
  invitation.status = 'pending';
  await invitation.save();

  await auditAdminAction({
    actor: req.user,
    action: 'ADMIN_INVITATION_RESENT',
    newValues: { invitationId: String(invitation._id) },
    req,
  });

  return res.json({
    message: "L'invitation a été renvoyée",
    invitation: {
      ...serializeInvitation(invitation),
      activationLink: `${req.protocol}://${req.get('host')}/admin/invitations/accept?token=${token}`,
    },
  });
});

router.post('/admin-invitations/:id/revoke', protect, authorizePermissions('admins.create'), async (req: AuthRequest, res) => {
  const invitation = await AdminInvitation.findById(req.params.id);

  if (!invitation) {
    return res.status(404).json({ message: 'Invitation introuvable' });
  }

  invitation.status = 'revoked';
  await invitation.save();

  await auditAdminAction({
    actor: req.user,
    action: 'ADMIN_INVITATION_REVOKED',
    newValues: { invitationId: String(invitation._id) },
    req,
  });

  return res.json({ message: "L'invitation a été révoquée" });
});

router.post('/admin-invitations/accept', async (req, res) => {
  try {
    const payload = acceptInvitationSchema.parse(req.body);
    const tokenHash = (await import('node:crypto')).createHash('sha256').update(payload.token).digest('hex');
    const invitation = await AdminInvitation.findOne({ tokenHash });

    if (!invitation) {
      return res.status(404).json({ message: 'Invitation introuvable' });
    }

    if (invitation.status !== 'pending') {
      return res.status(400).json({ message: "Cette invitation n'est plus active" });
    }

    if (invitation.expiresAt.getTime() < Date.now()) {
      invitation.status = 'expired';
      await invitation.save();
      return res.status(400).json({ message: 'Cette invitation a expiré' });
    }

    const rolePermissions = await getRolePermissions(invitation.role);
    let user = await User.findOne({ email: invitation.email }).select('+password');

    if (!user) {
      user = await User.create({
        firstName: invitation.firstName,
        lastName: invitation.lastName,
        email: invitation.email,
        password: payload.password,
        role: invitation.role,
        permissions: [...new Set([...(rolePermissions ?? []), ...(invitation.permissions ?? [])])],
        isVerified: true,
        isActive: true,
        mustChangePassword: false,
      });
    } else {
      user.firstName = invitation.firstName;
      user.lastName = invitation.lastName;
      user.password = payload.password;
      user.role = invitation.role;
      user.permissions = [...new Set([...(rolePermissions ?? []), ...(invitation.permissions ?? [])])];
      user.isVerified = true;
      user.isActive = true;
      user.mustChangePassword = false;
      await user.save();
    }

    invitation.status = 'accepted';
    invitation.acceptedAt = new Date();
    await invitation.save();

    await auditAdminAction({
      action: 'ADMIN_INVITATION_ACCEPTED',
      targetUser: String(user._id),
      newValues: { email: user.email, role: user.role },
    });

    return res.json({ message: 'Invitation acceptée avec succès' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.issues[0]?.message ?? 'Données invalides' });
    }

    return res.status(400).json({ message: "Impossible d'accepter cette invitation", error });
  }
});

export default router;
