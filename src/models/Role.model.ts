import mongoose, { Document, Schema, Types } from 'mongoose';
import { AVAILABLE_PERMISSIONS, type UserPermission } from './User.model.js';

export interface IRole extends Document {
  name: string;
  code: string;
  description?: string;
  permissions: UserPermission[];
  isSystem: boolean;
  isActive: boolean;
  createdBy: Types.ObjectId | null;
  updatedBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const RoleSchema = new Schema<IRole>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 80,
      index: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
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
    isSystem: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const Role =
  (mongoose.models.Role as mongoose.Model<IRole>) || mongoose.model<IRole>('Role', RoleSchema);

export default Role;
