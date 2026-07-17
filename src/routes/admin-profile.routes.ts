import express from 'express';
import { z } from 'zod';
import User from '../models/User.model.js';
import { AuthRequest, authorizePermissions, protect } from '../middleware/auth.middleware.js';
import { auditAdminAction, getCurrentSessionIdFromRequest, serializeSession } from '../utils/admin-security.js';
import AdminSession from '../models/AdminSession.model.js';
import { deleteStoredAsset, imageUpload, storeUploadedImage } from '../utils/upload.js';

const router = express.Router();

const profileSchema = z.object({
  firstName: z.string().trim().min(1, 'Le prénom est requis'),
  lastName: z.string().trim().min(1, 'Le nom est requis'),
  phone: z.string().trim().max(40).optional().or(z.literal('')),
  preferredLanguage: z.string().trim().min(2).max(10),
  timezone: z.string().trim().min(2).max(100),
  notificationPreferences: z.object({
    email: z.boolean(),
    security: z.boolean(),
    donations: z.boolean(),
    content: z.boolean(),
  }),
});

const emailSchema = z.object({
  email: z.string().trim().email("L'adresse email est invalide"),
  currentPassword: z.string().min(1, 'Le mot de passe actuel est requis'),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Le mot de passe actuel est requis'),
    newPassword: z
      .string()
      .min(10, 'Le nouveau mot de passe doit contenir au moins 10 caractères')
      .regex(/[A-Z]/, 'Le mot de passe doit contenir une majuscule')
      .regex(/[a-z]/, 'Le mot de passe doit contenir une minuscule')
      .regex(/[0-9]/, 'Le mot de passe doit contenir un chiffre')
      .regex(/[^A-Za-z0-9]/, 'Le mot de passe doit contenir un caractère spécial'),
    confirmPassword: z.string().min(1, 'La confirmation est requise'),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: 'La confirmation du mot de passe ne correspond pas',
    path: ['confirmPassword'],
  });

const serializeProfileUser = (user: any) => ({
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
  notificationPreferences: user.notificationPreferences ?? {},
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  lastLoginAt: user.lastLoginAt ?? null,
  passwordChangedAt: user.passwordChangedAt ?? null,
});

router.get(
  '/',
  protect,
  authorizePermissions('dashboard.read'),
  async (req: AuthRequest, res) => {
    const user = await User.findById(req.user?._id).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'Profil administrateur introuvable' });
    }

    return res.json({ profile: serializeProfileUser(user) });
  }
);

router.patch(
  '/',
  protect,
  authorizePermissions('dashboard.read'),
  async (req: AuthRequest, res) => {
    try {
      const payload = profileSchema.parse(req.body);
      const user = await User.findById(req.user?._id).select('-password');

      if (!user) {
        return res.status(404).json({ message: 'Profil administrateur introuvable' });
      }

      const previousValues = {
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone ?? '',
        preferredLanguage: user.preferredLanguage ?? 'fr',
        timezone: user.timezone ?? 'America/Port-au-Prince',
        notificationPreferences: user.notificationPreferences ?? {},
      };

      user.firstName = payload.firstName;
      user.lastName = payload.lastName;
      user.phone = payload.phone ?? '';
      user.preferredLanguage = payload.preferredLanguage;
      user.timezone = payload.timezone;
      user.notificationPreferences = payload.notificationPreferences;
      user.updatedBy = req.user?._id ?? null;
      await user.save();

      await auditAdminAction({
        actor: req.user,
        action: 'ADMIN_PROFILE_UPDATED',
        targetUser: String(user._id),
        previousValues,
        newValues: payload,
        req,
      });

      return res.json({
        message: 'Profil administrateur mis à jour',
        profile: serializeProfileUser(user),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.issues[0]?.message ?? 'Données invalides' });
      }

      return res.status(400).json({ message: 'Impossible de mettre à jour le profil', error });
    }
  }
);

router.patch(
  '/email',
  protect,
  authorizePermissions('dashboard.read'),
  async (req: AuthRequest, res) => {
    try {
      const payload = emailSchema.parse(req.body);
      const user = await User.findById(req.user?._id).select('+password');

      if (!user) {
        return res.status(404).json({ message: 'Profil administrateur introuvable' });
      }

      const isCurrentPasswordValid = await user.comparePassword(payload.currentPassword);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({ message: 'Le mot de passe actuel est incorrect' });
      }

      const existingUser = await User.findOne({
        email: payload.email,
        _id: { $ne: user._id },
      });

      if (existingUser) {
        return res.status(400).json({ message: 'Cette adresse email est déjà utilisée' });
      }

      const previousEmail = user.email;
      user.email = payload.email;
      user.updatedBy = req.user?._id ?? null;
      await user.save();

      await auditAdminAction({
        actor: req.user,
        action: 'ADMIN_EMAIL_CHANGED',
        targetUser: String(user._id),
        previousValues: { email: previousEmail },
        newValues: { email: payload.email },
        req,
      });

      return res.json({
        message: 'Adresse email mise à jour avec succès',
        profile: serializeProfileUser(user),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.issues[0]?.message ?? 'Données invalides' });
      }

      return res.status(400).json({ message: "Impossible de modifier l'adresse email", error });
    }
  }
);

router.patch(
  '/password',
  protect,
  authorizePermissions('dashboard.read'),
  async (req: AuthRequest, res) => {
    try {
      const payload = passwordSchema.parse(req.body);
      const user = await User.findById(req.user?._id).select('+password');

      if (!user) {
        return res.status(404).json({ message: 'Profil administrateur introuvable' });
      }

      const isCurrentPasswordValid = await user.comparePassword(payload.currentPassword);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({ message: 'Le mot de passe actuel est incorrect' });
      }

      const isSamePassword = await user.comparePassword(payload.newPassword);
      if (isSamePassword) {
        return res.status(400).json({ message: "Le nouveau mot de passe doit être différent de l'ancien" });
      }

      user.password = payload.newPassword;
      user.mustChangePassword = false;
      user.updatedBy = req.user?._id ?? null;
      await user.save();

      const currentSessionId = getCurrentSessionIdFromRequest(req);
      await AdminSession.updateMany(
        {
          user: user._id,
          refreshTokenId: { $ne: currentSessionId },
          revokedAt: null,
        },
        { $set: { revokedAt: new Date() } }
      );

      await auditAdminAction({
        actor: req.user,
        action: 'ADMIN_PASSWORD_CHANGED',
        targetUser: String(user._id),
        req,
      });

      return res.json({ message: 'Mot de passe mis à jour avec succès' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.issues[0]?.message ?? 'Données invalides' });
      }

      return res.status(400).json({ message: 'Impossible de modifier le mot de passe', error });
    }
  }
);

router.post(
  '/avatar',
  protect,
  authorizePermissions('dashboard.read'),
  (req, res) => {
    imageUpload.single('image')(req, res, async (error: unknown) => {
      if (error) {
        return res.status(400).json({ message: "Impossible de téléverser l'avatar." });
      }

      const uploadedFile = req.file;

      if (!uploadedFile) {
        return res.status(400).json({ message: 'Aucun fichier image reçu.' });
      }

      try {
        const user = await User.findById((req as AuthRequest).user?._id).select('-password');

        if (!user) {
          return res.status(404).json({ message: 'Profil administrateur introuvable' });
        }

        const previousAvatarUrl = user.avatarUrl ?? null;
        const storedImage = await storeUploadedImage(req, uploadedFile);
        user.avatarUrl = storedImage.url;
        user.updatedBy = (req as AuthRequest).user?._id ?? null;
        await user.save();

        if (previousAvatarUrl) {
          await deleteStoredAsset({ fileUrl: previousAvatarUrl });
        }

        await auditAdminAction({
          actor: (req as AuthRequest).user,
          action: 'ADMIN_AVATAR_UPDATED',
          targetUser: String(user._id),
          previousValues: { avatarUrl: previousAvatarUrl },
          newValues: { avatarUrl: user.avatarUrl },
          req,
        });

        return res.status(201).json({
          message: 'Avatar mis à jour avec succès',
          avatarUrl: user.avatarUrl,
        });
      } catch (uploadError) {
        return res.status(500).json({
          message: "Impossible d'enregistrer l'avatar téléversé.",
          error: uploadError,
        });
      }
    });
  }
);

router.delete(
  '/avatar',
  protect,
  authorizePermissions('dashboard.read'),
  async (req: AuthRequest, res) => {
    const user = await User.findById(req.user?._id).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'Profil administrateur introuvable' });
    }

    const previousAvatarUrl = user.avatarUrl ?? null;
    user.avatarUrl = null;
    user.updatedBy = req.user?._id ?? null;
    await user.save();

    if (previousAvatarUrl) {
      await deleteStoredAsset({ fileUrl: previousAvatarUrl });
    }

    await auditAdminAction({
      actor: req.user,
      action: 'ADMIN_AVATAR_REMOVED',
      targetUser: String(user._id),
      previousValues: { avatarUrl: previousAvatarUrl },
      newValues: { avatarUrl: null },
      req,
    });

    return res.json({ message: 'Avatar supprimé avec succès' });
  }
);

router.get(
  '/sessions',
  protect,
  authorizePermissions('dashboard.read'),
  async (req: AuthRequest, res) => {
    const sessions = await AdminSession.find({
      user: req.user?._id,
      revokedAt: null,
    }).sort({ lastActivityAt: -1 });

    const currentSessionId = getCurrentSessionIdFromRequest(req);

    return res.json({
      items: sessions.map((session) => ({
        ...serializeSession(session),
        isCurrent: currentSessionId === session.refreshTokenId,
      })),
    });
  }
);

router.delete(
  '/sessions/:id',
  protect,
  authorizePermissions('dashboard.read'),
  async (req: AuthRequest, res) => {
    const session = await AdminSession.findOne({
      _id: req.params.id,
      user: req.user?._id,
      revokedAt: null,
    });

    if (!session) {
      return res.status(404).json({ message: 'Session introuvable' });
    }

    session.revokedAt = new Date();
    await session.save();

    await auditAdminAction({
      actor: req.user,
      action: 'ADMIN_PROFILE_SESSION_REVOKED',
      targetUser: String(req.user?._id),
      newValues: { sessionId: String(session._id) },
      req,
    });

    return res.json({ message: 'Session révoquée avec succès' });
  }
);

router.delete(
  '/sessions',
  protect,
  authorizePermissions('dashboard.read'),
  async (req: AuthRequest, res) => {
    const currentSessionId = getCurrentSessionIdFromRequest(req);

    await AdminSession.updateMany(
      {
        user: req.user?._id,
        refreshTokenId: { $ne: currentSessionId },
        revokedAt: null,
      },
      { $set: { revokedAt: new Date() } }
    );

    await auditAdminAction({
      actor: req.user,
      action: 'ADMIN_PROFILE_OTHER_SESSIONS_REVOKED',
      targetUser: String(req.user?._id),
      req,
    });

    return res.json({ message: 'Toutes les autres sessions ont été révoquées' });
  }
);

export default router;
