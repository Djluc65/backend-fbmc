import express from 'express';
import SiteContent from '../models/SiteContent.model.js';
import { defaultSiteContent } from '../content/defaultSiteContent.js';
import { AuthRequest, authorizePermissions, protect } from '../middleware/auth.middleware.js';

const router = express.Router();

const getOrCreateSiteContent = async () => {
  let document = await SiteContent.findOne({ key: 'main' });

  if (!document) {
    document = await SiteContent.create({
      key: 'main',
      content: defaultSiteContent,
    });
  }

  return document;
};

// @desc    Obtenir le contenu public du site
// @route   GET /api/site-content
// @access  Public
router.get('/', async (_req, res) => {
  try {
    const document = await getOrCreateSiteContent();
    return res.json(document.content);
  } catch (error) {
    return res.status(500).json({ message: 'Impossible de récupérer le contenu du site', error });
  }
});

// @desc    Obtenir le contenu du site pour l'administration
// @route   GET /api/site-content/admin
// @access  Private
router.get('/admin', protect, authorizePermissions('content.manage'), async (_req: AuthRequest, res) => {
  try {
    const document = await getOrCreateSiteContent();
    return res.json({
      _id: document._id,
      key: document.key,
      content: document.content,
      updatedBy: document.updatedBy,
      updatedAt: document.updatedAt,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Impossible de récupérer le contenu du site', error });
  }
});

// @desc    Mettre à jour le contenu du site
// @route   PUT /api/site-content/admin
// @access  Private
router.put('/admin', protect, authorizePermissions('content.manage'), async (req: AuthRequest, res) => {
  try {
    const content = req.body;

    if (!content || typeof content !== 'object' || Array.isArray(content)) {
      return res.status(400).json({ message: 'Le contenu du site doit être un objet JSON valide' });
    }

    const document = await getOrCreateSiteContent();
    document.content = content;
    document.updatedBy = req.user?._id ?? null;
    await document.save();

    return res.json({
      message: 'Contenu du site mis à jour avec succès',
      content: document.content,
      updatedAt: document.updatedAt,
    });
  } catch (error) {
    return res.status(400).json({ message: 'Impossible de mettre à jour le contenu du site', error });
  }
});

export default router;
