import express from 'express';
import User, { DEFAULT_ROLE_PERMISSIONS, UserRole } from '../models/User.model.js';
import { AuthRequest, authorizePermissions, protect } from '../middleware/auth.middleware.js';

const router = express.Router();

const STAFF_ROLES: UserRole[] = [
  'admin',
  'manager',
  'donations_manager',
  'content_editor',
  'beneficiary_manager',
];

const manageableRolesByCreator: Record<UserRole, UserRole[]> = {
  admin: STAFF_ROLES,
  manager: ['donations_manager', 'content_editor', 'beneficiary_manager'],
  donations_manager: [],
  content_editor: [],
  beneficiary_manager: [],
  benefactor: [],
  user: [],
};

const canManageRole = (currentUserRole: UserRole, targetRole: UserRole) => {
  return manageableRolesByCreator[currentUserRole]?.includes(targetRole) ?? false;
};

const serializeUser = (user: any) => ({
  _id: user._id,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  role: user.role,
  permissions: typeof user.getEffectivePermissions === 'function'
    ? user.getEffectivePermissions()
    : user.permissions || [],
  isVerified: user.isVerified,
  isActive: user.isActive,
  createdBy: user.createdBy ?? null,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

// @desc    Lister les rôles disponibles et leurs permissions par défaut
// @route   GET /api/staff/roles
// @access  Private
router.get('/roles', protect, authorizePermissions('staff.manage'), async (_req, res) => {
  const roles = Object.entries(DEFAULT_ROLE_PERMISSIONS).map(([role, permissions]) => ({
    role,
    permissions,
  }));

  return res.json(roles);
});

// @desc    Lister les comptes du personnel
// @route   GET /api/staff
// @access  Private
router.get('/', protect, authorizePermissions('staff.manage'), async (req: AuthRequest, res) => {
  try {
    const query =
      req.user?.role === 'admin'
        ? { role: { $in: STAFF_ROLES } }
        : { role: { $in: manageableRolesByCreator[req.user!.role] } };

    const staffMembers = await User.find(query).select('-password').sort({ createdAt: -1 });
    return res.json(staffMembers.map(serializeUser));
  } catch (error) {
    return res.status(500).json({ message: 'Impossible de récupérer la liste du personnel', error });
  }
});

// @desc    Créer un compte du personnel
// @route   POST /api/staff
// @access  Private
router.post('/', protect, authorizePermissions('staff.manage'), async (req: AuthRequest, res) => {
  try {
    const { firstName, lastName, email, password, role, permissions = [], isVerified = true } = req.body;

    if (!role || !STAFF_ROLES.includes(role)) {
      return res.status(400).json({ message: 'Rôle de personnel invalide' });
    }

    if (!canManageRole(req.user!.role, role)) {
      return res.status(403).json({ message: 'Vous ne pouvez pas attribuer ce rôle' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Cet email est déjà utilisé' });
    }

    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      role,
      permissions,
      isVerified,
      isActive: true,
      createdBy: req.user!._id,
    });

    return res.status(201).json({
      message: 'Compte du personnel créé avec succès',
      user: serializeUser(user),
    });
  } catch (error) {
    return res.status(400).json({ message: 'Impossible de créer ce compte du personnel', error });
  }
});

// @desc    Mettre à jour un compte du personnel
// @route   PATCH /api/staff/:id
// @access  Private
router.patch('/:id', protect, authorizePermissions('staff.manage'), async (req: AuthRequest, res) => {
  try {
    const staffMember = await User.findById(req.params.id);
    if (!staffMember) {
      return res.status(404).json({ message: 'Compte du personnel non trouvé' });
    }

    if (!STAFF_ROLES.includes(staffMember.role)) {
      return res.status(400).json({ message: 'Ce compte ne fait pas partie du personnel administratif' });
    }

    if (!canManageRole(req.user!.role, staffMember.role)) {
      return res.status(403).json({ message: 'Vous ne pouvez pas modifier ce compte' });
    }

    const { firstName, lastName, role, permissions, isVerified } = req.body;

    if (role) {
      if (!STAFF_ROLES.includes(role)) {
        return res.status(400).json({ message: 'Nouveau rôle invalide' });
      }

      if (!canManageRole(req.user!.role, role)) {
        return res.status(403).json({ message: 'Vous ne pouvez pas attribuer ce rôle' });
      }

      staffMember.role = role;
    }

    if (typeof firstName === 'string') {
      staffMember.firstName = firstName;
    }

    if (typeof lastName === 'string') {
      staffMember.lastName = lastName;
    }

    if (Array.isArray(permissions)) {
      staffMember.permissions = permissions;
    }

    if (typeof isVerified === 'boolean') {
      staffMember.isVerified = isVerified;
    }

    await staffMember.save();

    return res.json({
      message: 'Compte du personnel mis à jour',
      user: serializeUser(staffMember),
    });
  } catch (error) {
    return res.status(400).json({ message: 'Impossible de mettre à jour ce compte', error });
  }
});

// @desc    Activer ou désactiver un compte du personnel
// @route   PATCH /api/staff/:id/status
// @access  Private
router.patch('/:id/status', protect, authorizePermissions('staff.manage'), async (req: AuthRequest, res) => {
  try {
    const { isActive } = req.body;
    const staffMember = await User.findById(req.params.id);

    if (!staffMember) {
      return res.status(404).json({ message: 'Compte du personnel non trouvé' });
    }

    if (!canManageRole(req.user!.role, staffMember.role)) {
      return res.status(403).json({ message: 'Vous ne pouvez pas modifier ce compte' });
    }

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ message: 'Le statut isActive est requis' });
    }

    staffMember.isActive = isActive;
    await staffMember.save();

    return res.json({
      message: isActive ? 'Compte activé avec succès' : 'Compte désactivé avec succès',
      user: serializeUser(staffMember),
    });
  } catch (error) {
    return res.status(400).json({ message: 'Impossible de modifier le statut du compte', error });
  }
});

// @desc    Réinitialiser le mot de passe d'un membre du personnel
// @route   PATCH /api/staff/:id/password
// @access  Private
router.patch('/:id/password', protect, authorizePermissions('staff.manage'), async (req: AuthRequest, res) => {
  try {
    const { password } = req.body;
    const staffMember = await User.findById(req.params.id);

    if (!staffMember) {
      return res.status(404).json({ message: 'Compte du personnel non trouvé' });
    }

    if (!canManageRole(req.user!.role, staffMember.role)) {
      return res.status(403).json({ message: 'Vous ne pouvez pas modifier ce compte' });
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({
        message: 'Le nouveau mot de passe est requis et doit contenir au moins 6 caractères',
      });
    }

    staffMember.password = password;
    await staffMember.save();

    return res.json({ message: 'Mot de passe réinitialisé avec succès' });
  } catch (error) {
    return res.status(400).json({ message: 'Impossible de réinitialiser le mot de passe', error });
  }
});

// @desc    Supprimer un compte du personnel
// @route   DELETE /api/staff/:id
// @access  Private
router.delete('/:id', protect, authorizePermissions('staff.manage'), async (req: AuthRequest, res) => {
  try {
    const staffMember = await User.findById(req.params.id);
    if (!staffMember) {
      return res.status(404).json({ message: 'Compte du personnel non trouvé' });
    }

    if (!canManageRole(req.user!.role, staffMember.role)) {
      return res.status(403).json({ message: 'Vous ne pouvez pas supprimer ce compte' });
    }

    await staffMember.deleteOne();
    return res.json({ message: 'Compte du personnel supprimé avec succès' });
  } catch (error) {
    return res.status(400).json({ message: 'Impossible de supprimer ce compte', error });
  }
});

export default router;
