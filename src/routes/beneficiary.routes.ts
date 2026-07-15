import express from 'express';
import Beneficiary from '../models/Beneficiary.model.js';
import { protect, authorizePermissions } from '../middleware/auth.middleware.js';

const router = express.Router();

// @desc    Obtenir tous les bénéficiaires
// @route   GET /api/beneficiaries
// @access  Public
router.get('/', async (req, res) => {
  try {
    const beneficiaries = await Beneficiary.find({ status: 'active' })
      .sort({ createdAt: -1 });
    res.json(beneficiaries);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error });
  }
});

// @desc    Obtenir un bénéficiaire
// @route   GET /api/beneficiaries/:id
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const beneficiary = await Beneficiary.findById(req.params.id);
    if (beneficiary) {
      res.json(beneficiary);
    } else {
      res.status(404).json({ message: 'Bénéficiaire non trouvé' });
    }
  } catch (error) {
    res.status(400).json({ message: 'ID invalide', error });
  }
});

// @desc    Créer un bénéficiaire
// @route   POST /api/beneficiaries
// @access  Private
router.post('/', protect, authorizePermissions('beneficiaries.manage'), async (req, res) => {
  try {
    const beneficiary = await Beneficiary.create(req.body);
    res.status(201).json(beneficiary);
  } catch (error) {
    res.status(400).json({ message: 'Données invalides', error });
  }
});

// @desc    Mettre à jour un bénéficiaire
// @route   PUT /api/beneficiaries/:id
// @access  Private
router.put('/:id', protect, authorizePermissions('beneficiaries.manage'), async (req, res) => {
  try {
    const beneficiary = await Beneficiary.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (beneficiary) {
      res.json(beneficiary);
    } else {
      res.status(404).json({ message: 'Bénéficiaire non trouvé' });
    }
  } catch (error) {
    res.status(400).json({ message: 'Données invalides', error });
  }
});

// @desc    Supprimer un bénéficiaire
// @route   DELETE /api/beneficiaries/:id
// @access  Private
router.delete('/:id', protect, authorizePermissions('beneficiaries.manage'), async (req, res) => {
  try {
    const beneficiary = await Beneficiary.findByIdAndDelete(req.params.id);
    if (beneficiary) {
      res.json({ message: 'Bénéficiaire supprimé' });
    } else {
      res.status(404).json({ message: 'Bénéficiaire non trouvé' });
    }
  } catch (error) {
    res.status(400).json({ message: 'Erreur', error });
  }
});

export default router;
