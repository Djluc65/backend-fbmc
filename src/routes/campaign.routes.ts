import express from 'express';
import Campaign from '../models/Campaign.model.js';
import { AuthRequest, protect, authorizePermissions } from '../middleware/auth.middleware.js';

const router = express.Router();

// @desc    Obtenir toutes les campagnes
// @route   GET /api/campaigns
// @access  Public
router.get('/', async (req, res) => {
  try {
    const campaigns = await Campaign.find().sort({ createdAt: -1 });
    res.json(campaigns);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error });
  }
});

// @desc    Obtenir une seule campagne
// @route   GET /api/campaigns/:id
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    if (campaign) {
      res.json(campaign);
    } else {
      res.status(404).json({ message: 'Campagne non trouvée' });
    }
  } catch (error) {
    res.status(400).json({ message: 'ID invalide', error });
  }
});

// @desc    Créer une campagne
// @route   POST /api/campaigns
// @access  Private
router.post('/', protect, authorizePermissions('campaigns.manage'), async (req: AuthRequest, res) => {
  try {
    const campaign = await Campaign.create(req.body);
    res.status(201).json(campaign);
  } catch (error) {
    res.status(400).json({ message: 'Données invalides', error });
  }
});

// @desc    Mettre à jour une campagne
// @route   PUT /api/campaigns/:id
// @access  Private
router.put('/:id', protect, authorizePermissions('campaigns.manage'), async (req, res) => {
  try {
    const campaign = await Campaign.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (campaign) {
      res.json(campaign);
    } else {
      res.status(404).json({ message: 'Campagne non trouvée' });
    }
  } catch (error) {
    res.status(400).json({ message: 'Données invalides', error });
  }
});

// @desc    Supprimer une campagne
// @route   DELETE /api/campaigns/:id
// @access  Private
router.delete('/:id', protect, authorizePermissions('campaigns.manage'), async (req, res) => {
  try {
    const campaign = await Campaign.findByIdAndDelete(req.params.id);
    if (campaign) {
      res.json({ message: 'Campagne supprimée' });
    } else {
      res.status(404).json({ message: 'Campagne non trouvée' });
    }
  } catch (error) {
    res.status(400).json({ message: 'Erreur', error });
  }
});

export default router;
