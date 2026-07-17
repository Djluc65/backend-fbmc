import crypto from 'node:crypto';
import type { Request } from 'express';
import User from '../models/User.model.js';
import PasswordResetToken from '../models/PasswordResetToken.model.js';
import { auditAdminAction } from '../utils/admin-security.js';
import { buildAdminPasswordResetEmail } from '../emails/admin-password-reset-email.js';
import { sendEmail } from './mail.service.js';

const ADMIN_PANEL_ROLES = new Set([
  'admin',
  'super_admin',
  'manager',
  'finance_manager',
  'donations_manager',
  'content_editor',
  'content_manager',
  'campaign_manager',
  'editor',
  'reviewer',
  'support_manager',
]);

const PASSWORD_RESET_PURPOSE = 'ADMIN_PASSWORD_RESET';
const FORGOT_PASSWORD_GENERIC_MESSAGE =
  'Si un compte correspondant existe, un lien de réinitialisation a été envoyé.';

const getPasswordResetTokenExpiresMinutes = () => {
  const value = Number(process.env.PASSWORD_RESET_TOKEN_EXPIRES_MINUTES || 30);
  return Number.isFinite(value) && value >= 15 && value <= 60 ? value : 30;
};

const getPasswordResetBaseUrl = () =>
  (process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');

const isAdministrativeUser = (user: { role?: string | null; permissions?: string[] | null }) => {
  if (!user.role) {
    return false;
  }

  return ADMIN_PANEL_ROLES.has(user.role) || (user.permissions ?? []).includes('*');
};

export const hashPasswordResetToken = (rawToken: string) =>
  crypto.createHash('sha256').update(rawToken).digest('hex');

const buildPasswordResetLink = (rawToken: string) => `${getPasswordResetBaseUrl()}/admin/reset-password/${rawToken}`;

const createRawResetToken = () => crypto.randomBytes(32).toString('hex');

export const forgotAdminPasswordGenericResponse = {
  success: true,
  message: FORGOT_PASSWORD_GENERIC_MESSAGE,
};

export const requestAdminPasswordReset = async ({
  email,
  req,
}: {
  email: string;
  req: Request;
}) => {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail }).select('-password');

  if (!user || user.deletedAt || !user.isActive || !isAdministrativeUser(user)) {
    await auditAdminAction({
      action: 'ADMIN_PASSWORD_RESET_REQUEST_IGNORED',
      newValues: { reason: 'account_not_found_or_not_eligible' },
      req,
    });

    return forgotAdminPasswordGenericResponse;
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

  const recentRequestCount = await PasswordResetToken.countDocuments({
    userId: user._id,
    purpose: PASSWORD_RESET_PURPOSE,
    createdAt: { $gte: oneHourAgo },
  });

  if (recentRequestCount >= 3) {
    await auditAdminAction({
      actor: user,
      action: 'ADMIN_PASSWORD_RESET_REQUEST_THROTTLED',
      targetUser: String(user._id),
      newValues: { reason: 'hourly_limit_reached' },
      req,
    });

    return forgotAdminPasswordGenericResponse;
  }

  const latestActiveToken = await PasswordResetToken.findOne({
    userId: user._id,
    purpose: PASSWORD_RESET_PURPOSE,
    usedAt: null,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  if (latestActiveToken && latestActiveToken.createdAt >= fiveMinutesAgo) {
    await auditAdminAction({
      actor: user,
      action: 'ADMIN_PASSWORD_RESET_REQUEST_THROTTLED',
      targetUser: String(user._id),
      newValues: { reason: 'cooldown_active' },
      req,
    });

    return forgotAdminPasswordGenericResponse;
  }

  await PasswordResetToken.updateMany(
    {
      userId: user._id,
      purpose: PASSWORD_RESET_PURPOSE,
      usedAt: null,
      revokedAt: null,
    },
    { $set: { revokedAt: new Date() } }
  );

  const rawToken = createRawResetToken();
  const tokenHash = hashPasswordResetToken(rawToken);
  const expiresInMinutes = getPasswordResetTokenExpiresMinutes();
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

  const tokenDocument = await PasswordResetToken.create({
    userId: user._id,
    tokenHash,
    purpose: PASSWORD_RESET_PURPOSE,
    expiresAt,
    requestedIp: req.ip,
    requestedUserAgent: req.get('user-agent') ?? '',
  });

  await auditAdminAction({
    actor: user,
    action: 'ADMIN_PASSWORD_RESET_REQUESTED',
    targetUser: String(user._id),
    newValues: {
      purpose: PASSWORD_RESET_PURPOSE,
      expiresAt: tokenDocument.expiresAt,
    },
    req,
  });

  const resetUrl = buildPasswordResetLink(rawToken);
  const emailContent = buildAdminPasswordResetEmail({
    recipientName: `${user.firstName} ${user.lastName}`.trim(),
    resetUrl,
    expiresInMinutes,
    supportEmail: process.env.EMAIL_FROM || 'support@fondation.ht',
  });

  try {
    const emailResult = await sendEmail({
      to: user.email,
      subject: emailContent.subject,
      text: emailContent.text,
      html: emailContent.html,
    });

    await auditAdminAction({
      actor: user,
      action: 'ADMIN_PASSWORD_RESET_EMAIL_SENT',
      targetUser: String(user._id),
      newValues: {
        preview: emailResult.preview,
        messageId: emailResult.messageId ?? null,
      },
      req,
    });
  } catch (error) {
    tokenDocument.revokedAt = new Date();
    await tokenDocument.save();

    await auditAdminAction({
      actor: user,
      action: 'ADMIN_PASSWORD_RESET_EMAIL_FAILED',
      targetUser: String(user._id),
      newValues: {
        error: error instanceof Error ? error.message : 'unknown_email_error',
      },
      req,
    });
  }

  return forgotAdminPasswordGenericResponse;
};
