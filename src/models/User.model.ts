import mongoose, { Schema, Document, Types } from 'mongoose';
import bcrypt from 'bcryptjs';

export const AVAILABLE_PERMISSIONS = [
  'staff.manage',
  'content.manage',
  'donations.read',
  'donations.manage',
  'news.create',
  'news.update',
  'news.delete',
  'campaigns.manage',
  'beneficiaries.manage',
  'dashboard.read',
] as const;

export type UserPermission = (typeof AVAILABLE_PERMISSIONS)[number] | '*';

export const DEFAULT_ROLE_PERMISSIONS = {
  user: [],
  benefactor: ['dashboard.read'],
  super_admin: ['*'],
  admin: ['*'],
  manager: [
    'staff.manage',
    'content.manage',
    'donations.read',
    'donations.manage',
    'news.create',
    'news.update',
    'news.delete',
    'campaigns.manage',
    'beneficiaries.manage',
    'dashboard.read',
  ],
  finance_manager: ['donations.read', 'donations.manage', 'dashboard.read'],
  donations_manager: ['donations.read', 'donations.manage', 'dashboard.read'],
  content_editor: ['content.manage', 'news.create', 'news.update', 'news.delete', 'dashboard.read'],
  beneficiary_manager: ['beneficiaries.manage', 'dashboard.read'],
} as const satisfies Record<string, readonly UserPermission[]>;

export type UserRole = keyof typeof DEFAULT_ROLE_PERMISSIONS;

const roleValues = Object.keys(DEFAULT_ROLE_PERMISSIONS) as UserRole[];
const permissionValues = [...AVAILABLE_PERMISSIONS, '*'] as UserPermission[];

// Définir l'interface pour le modèle User
export interface IUser extends Document {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: UserRole;
  permissions: UserPermission[];
  isVerified: boolean;
  isActive: boolean;
  createdBy: Types.ObjectId | null;
  comparePassword(candidatePassword: string): Promise<boolean>;
  getEffectivePermissions(): UserPermission[];
  hasPermission(permission: UserPermission): boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Créer le schéma
const UserSchema: Schema<IUser> = new Schema(
  {
    firstName: {
      type: String,
      required: [true, 'Le prénom est requis'],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, 'Le nom est requis'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "L'email est requis"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,})+$/,
        'Veuillez saisir une adresse email valide',
      ],
    },
    password: {
      type: String,
      required: [true, 'Le mot de passe est requis'],
      minlength: [6, 'Le mot de passe doit comporter au moins 6 caractères'],
    },
    role: {
      type: String,
      enum: roleValues,
      default: 'user',
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
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Middleware pour hasher le mot de passe avant enregistrement
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Méthode pour comparer les mots de passe
UserSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

UserSchema.methods.getEffectivePermissions = function (): UserPermission[] {
  const rolePermissions = DEFAULT_ROLE_PERMISSIONS[this.role as UserRole] ?? [];
  return [...new Set([...rolePermissions, ...(this.permissions || [])])];
};

UserSchema.methods.hasPermission = function (permission: UserPermission): boolean {
  const effectivePermissions = this.getEffectivePermissions();
  return effectivePermissions.includes('*') || effectivePermissions.includes(permission);
};

// Exporter le modèle
const User = mongoose.model<IUser>('User', UserSchema);
export default User;
