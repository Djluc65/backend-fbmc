import jwt, { SignOptions } from 'jsonwebtoken';
import { CookieOptions, Response } from 'express';

const accessTokenExpiresIn = (process.env.JWT_ACCESS_EXPIRE || '15m') as unknown as SignOptions['expiresIn'];
const refreshTokenExpiresIn = (process.env.JWT_REFRESH_EXPIRE || '7d') as unknown as SignOptions['expiresIn'];

type SameSiteOption = NonNullable<CookieOptions['sameSite']>;

const getIsProduction = () => process.env.NODE_ENV === 'production';

const getSameSite = (): SameSiteOption => {
  const sameSite = process.env.COOKIE_SAME_SITE?.toLowerCase();

  if (sameSite === 'strict' || sameSite === 'lax' || sameSite === 'none') {
    return sameSite;
  }

  return getIsProduction() ? 'none' : 'lax';
};

const getBaseCookieOptions = (): CookieOptions => {
  const domain = process.env.COOKIE_DOMAIN?.trim();

  return {
    httpOnly: true,
    secure: getIsProduction(),
    sameSite: getSameSite(),
    ...(domain ? { domain } : {}),
  };
};

export const getRefreshTokenCookieOptions = (): CookieOptions => ({
  ...getBaseCookieOptions(),
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/api/auth',
});

export const getAccessTokenCookieOptions = (): CookieOptions => ({
  ...getBaseCookieOptions(),
  maxAge: 15 * 60 * 1000,
  path: '/',
});

export const clearAuthCookies = (res: Response) => {
  res.clearCookie('accessToken', getAccessTokenCookieOptions());
  res.clearCookie('refreshToken', getRefreshTokenCookieOptions());
};

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
  res.cookie('refreshToken', refreshToken, getRefreshTokenCookieOptions());
  res.cookie('accessToken', accessToken, getAccessTokenCookieOptions());
};
