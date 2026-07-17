import express from 'express';
import User from '../models/User.model.js';
import { AuthRequest, protect } from '../middleware/auth.middleware.js';
import {
  clearAuthCookies,
  generateAccessToken,
  generateRefreshToken,
  getAccessTokenCookieOptions,
  sendTokens,
} from '../utils/generateToken.js';
import jwt from 'jsonwebtoken';

const router = express.Router();

const getUserId = (user: { _id: unknown }) => String(user._id);

const serializeUser = (user: any) => ({
  _id: user._id,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  role: user.role,
  permissions: typeof user.getEffectivePermissions === 'function'
    ? user.getEffectivePermissions()
    : user.permissions || [],
  isVerified: user.isVerified,
  isActive: user.isActive,
  createdBy: user.createdBy ?? null,
});

const serializeAuthResponse = (user: any, accessToken: string) => ({
  user: serializeUser(user),
  accessToken,
});

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
      role: 'admin',
      permissions: ['*'],
      isVerified: true,
      isActive: true,
    });

    const accessToken = generateAccessToken(getUserId(user));
    const refreshToken = generateRefreshToken(getUserId(user));
    sendTokens(res, accessToken, refreshToken);

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
      const accessToken = generateAccessToken(getUserId(user));
      const refreshToken = generateRefreshToken(getUserId(user));
      sendTokens(res, accessToken, refreshToken);
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
    const user = await User.findOne({ email });
    if (user && (await user.comparePassword(password))) {
      if (!user.isActive) {
        return res.status(403).json({ message: 'Votre compte a été désactivé par un responsable' });
      }

      const accessToken = generateAccessToken(getUserId(user));
      const refreshToken = generateRefreshToken(getUserId(user));
      sendTokens(res, accessToken, refreshToken);
      return res.json(serializeAuthResponse(user, accessToken));
    } else {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }
  } catch (error) {
    res.status(400).json({ message: 'Données invalides', error });
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
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET as string) as any;
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ message: 'Non autorisé' });
    }
    const newAccessToken = generateAccessToken(getUserId(user));
    res.cookie('accessToken', newAccessToken, getAccessTokenCookieOptions());
    return res.json({ message: 'Token rafraîchi', accessToken: newAccessToken });
  } catch (error) {
    return res.status(401).json({ message: 'Token invalide' });
  }
});

// @desc    Déconnecter un utilisateur
// @route   POST /api/auth/logout
// @access  Private
router.post('/logout', (_req, res) => {
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

export default router;
