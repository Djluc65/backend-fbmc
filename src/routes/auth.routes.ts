import express from 'express';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import User from '../models/User.model.js';
import AdminSession from '../models/AdminSession.model.js';
import { AuthRequest, protect } from '../middleware/auth.middleware.js';
import {
  clearAuthCookies,
  generateAccessToken,
  generateRefreshToken,
  getAccessTokenCookieOptions,
  sendTokens,
} from '../utils/generateToken.js';
import {
  auditAdminAction,
  createAdminSession,
  getCurrentSessionIdFromRequest,
  serializeSession,
} from '../utils/admin-security.js';
import { forgotAdminPasswordSchema } from '../validations/admin-password-reset.validation.js';
import {
  forgotAdminPasswordGenericResponse,
  requestAdminPasswordReset,
} from '../services/admin-password-reset.service.js';

const router = express.Router();

const forgotPasswordRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Trop de demandes de réinitialisation. Réessayez plus tard.',
  },
});

const getUserId = (user: { _id: unknown }) => String(user._id);

const serializeUser = (user: any) => ({
  _id: user._id,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  phone: user.phone ?? '',
  avatarUrl: user.avatarUrl ?? null,
  role: user.role,
  permissions: typeof user.getEffectivePermissions === 'function'
    ? user.getEffectivePermissions()
    : user.permissions || [],
  isVerified: user.isVerified,
  isActive: user.isActive,
  mustChangePassword: user.mustChangePassword ?? false,
  preferredLanguage: user.preferredLanguage ?? 'fr',
  timezone: user.timezone ?? 'America/Port-au-Prince',
  notificationPreferences: user.notificationPreferences ?? {},
  createdBy: user.createdBy ?? null,
  updatedBy: user.updatedBy ?? null,
  lastLoginAt: user.lastLoginAt ?? null,
  passwordChangedAt: user.passwordChangedAt ?? null,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const serializeAuthResponse = (user: any, accessToken: string) => ({
  user: serializeUser(user),
  accessToken,
});

const issueAuthSession = async (req: express.Request, res: express.Response, user: any) => {
  const accessToken = generateAccessToken(getUserId(user));
  const session = await createAdminSession(req, getUserId(user));
  const refreshToken = generateRefreshToken(getUserId(user), session.refreshTokenId);
  sendTokens(res, accessToken, refreshToken);
  return accessToken;
};

// @desc    Créer le premier administrateur
// @route   POST /api/auth/bootstrap-admin
// @access  Public (une seule fois)
router.post('/bootstrap-admin', async (req, res) => {
  try {
    const adminExists = await User.findOne({ role: 'admin' });
    if (adminExists) {
      return res.status(403).json({
        message: 'Un administrateur existe déjà. Utilisez la connexion normale.',
      });
    }

    const { firstName, lastName, email, password } = req.body;
    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      role: 'super_admin',
      permissions: ['*'],
      isVerified: true,
      isActive: true,
      preferredLanguage: 'fr',
      timezone: 'America/Port-au-Prince',
    });

    const accessToken = await issueAuthSession(req, res, user);

    return res.status(201).json({
      message: 'Administrateur initial créé avec succès',
      ...serializeAuthResponse(user, accessToken),
    });
  } catch (error) {
    return res.status(400).json({ message: 'Impossible de créer l’administrateur initial', error });
  }
});

// @desc    Inscrire un utilisateur
// @route   POST /api/auth/register
// @access  Public
router.post('/register', async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;
    // Vérifier si l'utilisateur existe déjà
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'Cet email est déjà utilisé' });
    }
    // Créer l'utilisateur
    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      role: 'user',
    });
    // Générer les tokens
    if (user) {
      const accessToken = await issueAuthSession(req, res, user);
      return res.status(201).json(serializeAuthResponse(user, accessToken));
    }
  } catch (error) {
    res.status(400).json({ message: 'Données invalides', error });
  }
});

// @desc    Connecter un utilisateur
// @route   POST /api/auth/login
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password');
    if (user && (await user.comparePassword(password))) {
      if (!user.isActive) {
        return res.status(403).json({ message: 'Votre compte a été désactivé par un responsable' });
      }

      user.lastLoginAt = new Date();
      await user.save();

      const accessToken = await issueAuthSession(req, res, user);
      return res.json(serializeAuthResponse(user, accessToken));
    } else {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }
  } catch (error) {
    res.status(400).json({ message: 'Données invalides', error });
  }
});

router.post('/admin/forgot-password', forgotPasswordRateLimiter, async (req, res) => {
  try {
    const payload = forgotAdminPasswordSchema.parse(req.body);
    const response = await requestAdminPasswordReset({
      email: payload.email,
      req,
    });

    return res.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: error.issues[0]?.message ?? "L'adresse email est invalide",
      });
    }

    return res.json(forgotAdminPasswordGenericResponse);
  }
});

// @desc    Rafraîchir le token
// @route   POST /api/auth/refresh
// @access  Public
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.cookies;
  if (!refreshToken) {
    return res.status(401).json({ message: 'Non autorisé' });
  }
  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET as string) as {
      userId?: string;
      sessionId?: string;
    };

    const session = decoded.sessionId
      ? await AdminSession.findOne({
          refreshTokenId: decoded.sessionId,
          revokedAt: null,
        })
      : null;

    if (!session) {
      clearAuthCookies(res);
      return res.status(401).json({ message: 'Session expirée ou révoquée' });
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ message: 'Non autorisé' });
    }
    const newAccessToken = generateAccessToken(getUserId(user));
    session.lastActivityAt = new Date();
    await session.save();
    res.cookie('accessToken', newAccessToken, getAccessTokenCookieOptions());
    return res.json({ message: 'Token rafraîchi', accessToken: newAccessToken });
  } catch (error) {
    return res.status(401).json({ message: 'Token invalide' });
  }
});

// @desc    Déconnecter un utilisateur
// @route   POST /api/auth/logout
// @access  Private
router.post('/logout', async (req, res) => {
  const sessionId = getCurrentSessionIdFromRequest(req);
  if (sessionId) {
    await AdminSession.updateOne(
      { refreshTokenId: sessionId, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );
  }

  clearAuthCookies(res);
  return res.json({ message: 'Déconnexion réussie' });
});

// @desc    Obtenir le profil de l'utilisateur connecté
// @route   GET /api/auth/me
// @access  Private
router.get('/me', protect, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.user?._id).select('-password');
    if (user) {
      return res.json(serializeUser(user));
    } else {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
  } catch (error) {
    res.status(400).json({ message: 'Erreur', error });
  }
});

router.get('/sessions', protect, async (req: AuthRequest, res) => {
  try {
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
  } catch (error) {
    return res.status(500).json({ message: 'Impossible de récupérer les sessions actives', error });
  }
});

router.delete('/sessions/:id', protect, async (req: AuthRequest, res) => {
  try {
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
      action: 'AUTH_SESSION_REVOKED',
      targetUser: getUserId(req.user!),
      newValues: { sessionId: String(session._id) },
      req,
    });

    return res.json({ message: 'Session révoquée avec succès' });
  } catch (error) {
    return res.status(400).json({ message: 'Impossible de révoquer cette session', error });
  }
});

router.delete('/sessions', protect, async (req: AuthRequest, res) => {
  try {
    await AdminSession.updateMany(
      {
        user: req.user?._id,
        revokedAt: null,
      },
      { $set: { revokedAt: new Date() } }
    );
    clearAuthCookies(res);
    await auditAdminAction({
      actor: req.user,
      action: 'AUTH_ALL_SESSIONS_REVOKED',
      targetUser: getUserId(req.user!),
      req,
    });
    return res.json({ message: 'Toutes les sessions ont été révoquées' });
  } catch (error) {
    return res.status(400).json({ message: 'Impossible de révoquer toutes les sessions', error });
  }
});

router.post('/sessions/revoke-others', protect, async (req: AuthRequest, res) => {
  try {
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
      action: 'AUTH_OTHER_SESSIONS_REVOKED',
      targetUser: getUserId(req.user!),
      req,
    });

    return res.json({ message: 'Toutes les autres sessions ont été révoquées' });
  } catch (error) {
    return res.status(400).json({ message: 'Impossible de révoquer les autres sessions', error });
  }
});

export default router;
