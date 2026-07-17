import mongoose, { Document, Schema, Types } from 'mongoose';

export const PASSWORD_RESET_PURPOSES = ['ADMIN_PASSWORD_RESET'] as const;

export type PasswordResetPurpose = (typeof PASSWORD_RESET_PURPOSES)[number];

export interface IPasswordResetToken extends Document {
  userId: Types.ObjectId;
  tokenHash: string;
  purpose: PasswordResetPurpose;
  expiresAt: Date;
  usedAt: Date | null;
  revokedAt: Date | null;
  requestedIp?: string;
  requestedUserAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PasswordResetTokenSchema = new Schema<IPasswordResetToken>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      trim: true,
      index: true,
      unique: true,
    },
    purpose: {
      type: String,
      enum: PASSWORD_RESET_PURPOSES,
      required: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    usedAt: {
      type: Date,
      default: null,
      index: true,
    },
    revokedAt: {
      type: Date,
      default: null,
      index: true,
    },
    requestedIp: {
      type: String,
      trim: true,
      maxlength: 80,
      default: '',
    },
    requestedUserAgent: {
      type: String,
      trim: true,
      maxlength: 400,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

PasswordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
PasswordResetTokenSchema.index({ userId: 1, purpose: 1, createdAt: -1 });

const PasswordResetToken =
  (mongoose.models.PasswordResetToken as mongoose.Model<IPasswordResetToken>) ||
  mongoose.model<IPasswordResetToken>('PasswordResetToken', PasswordResetTokenSchema);

export default PasswordResetToken;
