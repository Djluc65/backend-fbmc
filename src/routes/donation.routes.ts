import express from 'express';
import Donation from '../models/Donation.model.js';
import Campaign from '../models/Campaign.model.js';
import { AuthRequest, protect, authorizePermissions } from '../middleware/auth.middleware.js';

const router = express.Router();

// @desc    Obtenir tous les dons
// @route   GET /api/donations
// @access  Private
router.get('/', protect, authorizePermissions('donations.read'), async (_req, res) => {
  try {
    const donations = await Donation.find()
      .populate('donor', 'firstName lastName email')
      .populate('campaign', 'title')
      .sort({ createdAt: -1 });
    res.json(donations);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error });
  }
});

// @desc    Obtenir les dons de l'utilisateur connecté
// @route   GET /api/donations/my-donations
// @access  Private
router.get('/my-donations', protect, async (req: AuthRequest, res) => {
  try {
    const donations = await Donation.find({ donor: req.user!._id })
      .populate('campaign', 'title')
      .sort({ createdAt: -1 });
    res.json(donations);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error });
  }
});

// @desc    Créer un don
// @route   POST /api/donations
// @access  Private
router.post('/', protect, async (req: AuthRequest, res) => {
  try {
    const { amount, campaign, isAnonymous, message } = req.body;
    const donation = await Donation.create({
      amount,
      donor: req.user!._id,
      campaign,
      isAnonymous,
      message,
      status: 'completed', // Pour l'instant, on marque comme complété
    });
    // Mettre à jour le montant collecté de la campagne si applicable
    if (campaign) {
      await Campaign.findByIdAndUpdate(campaign, { $inc: { raisedAmount: amount } });
    }
    res.status(201).json(donation);
  } catch (error) {
    res.status(400).json({ message: 'Données invalides', error });
  }
});

// @desc    Obtenir un don par son ID
// @route   GET /api/donations/:id
// @access  Private
router.get('/:id', protect, authorizePermissions('donations.read'), async (req, res) => {
  try {
    const donation = await Donation.findById(req.params.id)
      .populate('donor', 'firstName lastName email')
      .populate('campaign', 'title');
    if (donation) {
      res.json(donation);
    } else {
      res.status(404).json({ message: 'Don non trouvé' });
    }
  } catch (error) {
    res.status(400).json({ message: 'ID invalide', error });
  }
});

// @desc    Mettre à jour le statut d'un don
// @route   PATCH /api/donations/:id/status
// @access  Private
router.patch('/:id/status', protect, authorizePermissions('donations.manage'), async (req, res) => {
  try {
    const { status } = req.body;

    if (!['pending', 'completed', 'failed'].includes(status)) {
      return res.status(400).json({ message: 'Statut de don invalide' });
    }

    const donation = await Donation.findById(req.params.id);
    if (!donation) {
      return res.status(404).json({ message: 'Don non trouvé' });
    }

    donation.status = status;
    await donation.save();

    return res.json({ message: 'Statut du don mis à jour', donation });
  } catch (error) {
    return res.status(400).json({ message: 'Impossible de mettre à jour le don', error });
  }
});

export default router;
