import mongoose, { Schema, Document, Types } from 'mongoose';
import bcrypt from 'bcryptjs';

export const AVAILABLE_PERMISSIONS = [
  'users.read',
  'users.create',
  'users.update',
  'users.delete',
  'admins.read',
  'admins.create',
  'admins.update',
  'admins.disable',
  'admins.delete',
  'admins.assign_roles',
  'admins.assign_permissions',
  'admins.revoke_sessions',
  'staff.manage',
  'content.read',
  'content.manage',
  'campaigns.read',
  'campaigns.manage',
  'news.read',
  'news.create',
  'news.update',
  'news.delete',
  'news.publish',
  'donations.read',
  'donations.manage',
  'donations.approve',
  'donations.reject',
  'donations.refund',
  'donations.export',
  'payments.read',
  'payments.manage',
  'payments.verify',
  'reports.read',
  'reports.export',
  'audit.read',
  'settings.read',
  'settings.manage',
  'roles.read',
  'roles.create',
  'roles.update',
  'roles.delete',
  'dashboard.read',
  'beneficiaries.manage',
] as const;

export const SYSTEM_USER_ROLES = [
  'user',
  'benefactor',
  'super_admin',
  'admin',
  'manager',
  'finance_manager',
  'donations_manager',
  'content_editor',
  'beneficiary_manager',
  'content_manager',
  'campaign_manager',
  'editor',
  'reviewer',
  'support_manager',
] as const;

export type UserPermission = (typeof AVAILABLE_PERMISSIONS)[number] | '*';
export type UserRole = string;

export const DEFAULT_ROLE_PERMISSIONS: Record<string, readonly UserPermission[]> = {
  user: [],
  benefactor: ['dashboard.read'],
  super_admin: ['*'],
  admin: [
    'admins.read',
    'admins.create',
    'admins.update',
    'admins.disable',
    'admins.revoke_sessions',
    'staff.manage',
    'content.read',
    'content.manage',
    'campaigns.read',
    'campaigns.manage',
    'news.read',
    'news.create',
    'news.update',
    'news.delete',
    'news.publish',
    'donations.read',
    'donations.manage',
    'donations.export',
    'payments.read',
    'payments.manage',
    'payments.verify',
    'reports.read',
    'reports.export',
    'audit.read',
    'settings.read',
    'settings.manage',
    'roles.read',
    'dashboard.read',
  ],
  manager: [
    'staff.manage',
    'content.read',
    'content.manage',
    'campaigns.read',
    'campaigns.manage',
    'news.read',
    'news.create',
    'news.update',
    'news.delete',
    'donations.read',
    'donations.manage',
    'payments.read',
    'payments.verify',
    'reports.read',
    'dashboard.read',
  ],
  finance_manager: [
    'donations.read',
    'donations.manage',
    'donations.approve',
    'donations.reject',
    'donations.refund',
    'donations.export',
    'payments.read',
    'payments.manage',
    'payments.verify',
    'reports.read',
    'reports.export',
    'dashboard.read',
  ],
  donations_manager: [
    'donations.read',
    'donations.manage',
    'donations.approve',
    'donations.reject',
    'payments.read',
    'payments.verify',
    'dashboard.read',
  ],
  content_editor: ['content.read', 'content.manage', 'news.read', 'news.create', 'news.update', 'news.delete', 'dashboard.read'],
  beneficiary_manager: ['beneficiaries.manage', 'dashboard.read'],
  content_manager: [
    'content.read',
    'content.manage',
    'news.read',
    'news.create',
    'news.update',
    'news.delete',
    'news.publish',
    'settings.read',
    'dashboard.read',
  ],
  campaign_manager: ['campaigns.read', 'campaigns.manage', 'news.read', 'dashboard.read'],
  editor: ['news.read', 'news.create', 'news.update', 'dashboard.read'],
  reviewer: ['content.read', 'news.read', 'donations.approve', 'donations.reject', 'payments.verify', 'dashboard.read'],
  support_manager: ['users.read', 'settings.read', 'dashboard.read'],
};

const permissionValues = [...AVAILABLE_PERMISSIONS, '*'] as UserPermission[];

export interface NotificationPreferences {
  email: boolean;
  security: boolean;
  donations: boolean;
  content: boolean;
}

export interface IUser extends Document {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  password: string;
  avatarUrl?: string | null;
  role: UserRole;
  permissions: UserPermission[];
  isVerified: boolean;
  isActive: boolean;
  mustChangePassword: boolean;
  preferredLanguage: string;
  timezone: string;
  notificationPreferences: NotificationPreferences;
  lastLoginAt: Date | null;
  passwordChangedAt: Date | null;
  createdBy: Types.ObjectId | null;
  updatedBy: Types.ObjectId | null;
  deletedAt: Date | null;
  deletedBy: Types.ObjectId | null;
  deletionReason?: string | null;
  comparePassword(candidatePassword: string): Promise<boolean>;
  getEffectivePermissions(): UserPermission[];
  hasPermission(permission: UserPermission): boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema<IUser> = new Schema(
  {
    firstName: {
      type: String,
      required: [true, 'Le prénom est requis'],
      trim: true,
      maxlength: 100,
    },
    lastName: {
      type: String,
      required: [true, 'Le nom est requis'],
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      required: [true, "L'email est requis"],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,})+$/,
        'Veuillez saisir une adresse email valide',
      ],
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 40,
      default: '',
    },
    password: {
      type: String,
      required: [true, 'Le mot de passe est requis'],
      minlength: [6, 'Le mot de passe doit comporter au moins 6 caractères'],
      select: false,
    },
    avatarUrl: {
      type: String,
      trim: true,
      default: null,
    },
    role: {
      type: String,
      required: true,
      default: 'user',
      index: true,
    },
    permissions: {
      type: [
        {
          type: String,
          enum: permissionValues,
        },
      ],
      default: [],
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    mustChangePassword: {
      type: Boolean,
      default: false,
    },
    preferredLanguage: {
      type: String,
      trim: true,
      default: 'fr',
    },
    timezone: {
      type: String,
      trim: true,
      default: 'America/Port-au-Prince',
    },
    notificationPreferences: {
      email: { type: Boolean, default: true },
      security: { type: Boolean, default: true },
      donations: { type: Boolean, default: true },
      content: { type: Boolean, default: true },
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    passwordChangedAt: {
      type: Date,
      default: null,
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
    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
    deletedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    deletionReason: {
      type: String,
      trim: true,
      default: null,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
  }
);

UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  this.passwordChangedAt = new Date();
  next();
});

UserSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

UserSchema.methods.getEffectivePermissions = function (): UserPermission[] {
  const rolePermissions = DEFAULT_ROLE_PERMISSIONS[this.role] ?? [];
  return [...new Set([...(rolePermissions || []), ...(this.permissions || [])])];
};

UserSchema.methods.hasPermission = function (permission: UserPermission): boolean {
  const effectivePermissions = this.getEffectivePermissions();
  return effectivePermissions.includes('*') || effectivePermissions.includes(permission);
};

const User =
  (mongoose.models.User as mongoose.Model<IUser>) || mongoose.model<IUser>('User', UserSchema);

export default User;
