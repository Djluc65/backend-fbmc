import express from 'express';
import multer from 'multer';
import SiteContent from '../models/SiteContent.model.js';
import { defaultSiteContent } from '../content/defaultSiteContent.js';
import { AuthRequest, authorizePermissions, protect } from '../middleware/auth.middleware.js';
import { buildUploadedFileUrl, imageUpload } from '../utils/upload.js';

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

// @desc    Téléverser une image pour le contenu du site
// @route   POST /api/site-content/admin/upload
// @access  Private
router.post(
  '/admin/upload',
  protect,
  authorizePermissions('content.manage'),
  (req, res) => {
    imageUpload.single('image')(req, res, (error: unknown) => {
      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            message: 'Le fichier dépasse la taille maximale autorisée de 5 Mo.',
          });
        }

        return res.status(400).json({
          message: 'Veuillez téléverser une image valide au format JPG, PNG, WEBP, GIF ou SVG.',
        });
      }

      if (error) {
        return res.status(400).json({
          message: 'Impossible de téléverser ce fichier.',
        });
      }

      const uploadedFile = req.file;

      if (!uploadedFile) {
        return res.status(400).json({ message: 'Aucun fichier image reçu.' });
      }

      return res.status(201).json({
        message: 'Image téléversée avec succès.',
        fileName: uploadedFile.filename,
        url: buildUploadedFileUrl(req, uploadedFile.filename),
      });
    });
  }
);

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
