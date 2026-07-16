import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User, { DEFAULT_ROLE_PERMISSIONS, IUser, UserPermission, UserRole } from '../models/User.model.js';

// Interface pour ajouter l'utilisateur à la requête
export interface AuthRequest extends Request {
  user?: IUser | null;
}

// Middleware pour protéger les routes
export const protect = async (req: AuthRequest, res: Response, next: NextFunction) => {
  let token;
  try {
    // Vérifier si le token est dans les cookies ou les headers
    token = req.cookies.accessToken || (req.headers.authorization && req.headers.authorization.startsWith('Bearer') && req.headers.authorization.split(' ')[1]);

    if (!token) {
      return res.status(401).json({ message: 'Non autorisé, pas de token' });
    }

    // Vérifier le token
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET as string) as any;
    // Ajouter l'utilisateur à la requête (sans le mot de passe)
    req.user = await User.findById(decoded.userId).select('-password');
    if (!req.user || !req.user.isActive) {
      return res.status(401).json({ message: 'Compte introuvable ou inactif' });
    }
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Token invalide' });
  }
};

export const optionalAuth = async (req: AuthRequest, _res: Response, next: NextFunction) => {
  try {
    const token =
      req.cookies.accessToken ||
      (req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer') &&
        req.headers.authorization.split(' ')[1]);

    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET as string) as { userId?: string };
    req.user = decoded.userId ? await User.findById(decoded.userId).select('-password') : null;
    return next();
  } catch (_error) {
    req.user = null;
    return next();
  }
};

const getEffectivePermissions = (user: IUser): string[] => {
  const rolePermissions = DEFAULT_ROLE_PERMISSIONS[user.role as UserRole] ?? [];
  return [...new Set([...(rolePermissions || []), ...(user.permissions || [])])];
};

export const authorizeRoles = (...roles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentification requise' });
    }

    if (roles.includes(req.user.role)) {
      return next();
    }

    return res.status(403).json({ message: 'Non autorisé pour ce rôle' });
  };
};

export const authorizePermissions = (...permissions: UserPermission[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentification requise' });
    }

    const effectivePermissions = getEffectivePermissions(req.user);

    if (
      effectivePermissions.includes('*') ||
      permissions.some((permission) => effectivePermissions.includes(permission))
    ) {
      return next();
    }

    return res.status(403).json({ message: 'Vous ne disposez pas des permissions nécessaires' });
  };
};

// Compatibilité avec le code existant
export const adminOnly = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }

  return res.status(403).json({ message: 'Non autorisé, accès réservé aux administrateurs' });
};
