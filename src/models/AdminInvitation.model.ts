import crypto from 'node:crypto';
import mongoose, { Document, Schema, Types } from 'mongoose';
import { AVAILABLE_PERMISSIONS, type UserPermission } from './User.model.js';

export type AdminInvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export interface IAdminInvitation extends Document {
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  permissions: UserPermission[];
  tokenHash: string;
  expiresAt: Date;
  status: AdminInvitationStatus;
  invitedBy: Types.ObjectId | null;
  acceptedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export const createInvitationToken = () => {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  return { token, tokenHash };
};

const AdminInvitationSchema = new Schema<IAdminInvitation>(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    permissions: {
      type: [
        {
          type: String,
          enum: AVAILABLE_PERMISSIONS,
        },
      ],
      default: [],
    },
    tokenHash: {
      type: String,
      required: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'expired', 'revoked'],
      default: 'pending',
      index: true,
    },
    invitedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    acceptedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const AdminInvitation =
  (mongoose.models.AdminInvitation as mongoose.Model<IAdminInvitation>) ||
  mongoose.model<IAdminInvitation>('AdminInvitation', AdminInvitationSchema);

export default AdminInvitation;
