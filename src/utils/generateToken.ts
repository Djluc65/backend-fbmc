import jwt, { SignOptions } from 'jsonwebtoken';
import { Response } from 'express';

const accessTokenExpiresIn = (process.env.JWT_ACCESS_EXPIRE || '15m') as unknown as SignOptions['expiresIn'];
const refreshTokenExpiresIn = (process.env.JWT_REFRESH_EXPIRE || '7d') as unknown as SignOptions['expiresIn'];

// Générer un token d'accès
export const generateAccessToken = (userId: string) => {
  return jwt.sign(
    { userId },
    process.env.JWT_ACCESS_SECRET as string,
    { expiresIn: accessTokenExpiresIn }
  );
};

// Générer un token de rafraîchissement
export const generateRefreshToken = (userId: string) => {
  return jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET as string,
    { expiresIn: refreshTokenExpiresIn }
  );
};

// Envoyer les tokens via des cookies
export const sendTokens = (res: Response, accessToken: string, refreshToken: string) => {
  const isProduction = process.env.NODE_ENV === 'production';
  // Cookie pour le refresh token (httpOnly pour la sécurité)
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 jours
    path: '/api/auth',
  });
  // Cookie pour l'access token
  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    maxAge: 15 * 60 * 1000, // 15 minutes
    path: '/',
  });
};
