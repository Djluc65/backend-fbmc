import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IAdminSession extends Document {
  user: Types.ObjectId;
  refreshTokenId: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
  lastActivityAt: Date;
  revokedAt: Date | null;
}

const AdminSessionSchema = new Schema<IAdminSession>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    refreshTokenId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    ipAddress: {
      type: String,
      trim: true,
      maxlength: 80,
      default: '',
    },
    userAgent: {
      type: String,
      trim: true,
      maxlength: 400,
      default: '',
    },
    lastActivityAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    revokedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

const AdminSession =
  (mongoose.models.AdminSession as mongoose.Model<IAdminSession>) ||
  mongoose.model<IAdminSession>('AdminSession', AdminSessionSchema);

export default AdminSession;
