import express from 'express';
import multer from 'multer';
import News from '../models/News.model.js';
import { AuthRequest, protect, authorizePermissions } from '../middleware/auth.middleware.js';
import { buildUploadedFileUrl, imageUpload } from '../utils/upload.js';

const router = express.Router();

// @desc    Obtenir toutes les actualités pour l'administration
// @route   GET /api/news/admin/all
// @access  Private
router.get(
  '/admin/all',
  protect,
  authorizePermissions('news.create', 'news.update', 'news.delete'),
  async (_req: AuthRequest, res) => {
    try {
      const news = await News.find()
        .populate('author', 'firstName lastName')
        .sort({ createdAt: -1 });
      return res.json(news);
    } catch (error) {
      return res.status(500).json({ message: 'Erreur serveur', error });
    }
  }
);

// @desc    Obtenir toutes les actualités publiées
// @route   GET /api/news
// @access  Public
router.get('/', async (_req, res) => {
  try {
    const news = await News.find({ status: 'published' })
      .populate('author', 'firstName lastName')
      .sort({ createdAt: -1 });
    res.json(news);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error });
  }
});

// @desc    Obtenir une seule actualité
// @route   GET /api/news/:id
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const news = await News.findById(req.params.id)
      .populate('author', 'firstName lastName');
    if (news) {
      // Incrémenter le compteur de vues
      news.views += 1;
      await news.save();
      res.json(news);
    } else {
      res.status(404).json({ message: 'Actualité non trouvée' });
    }
  } catch (error) {
    res.status(400).json({ message: 'ID invalide', error });
  }
});

// @desc    Créer une actualité
// @route   POST /api/news
// @access  Private
router.post('/', protect, authorizePermissions('news.create'), async (req: AuthRequest, res) => {
  try {
    const news = await News.create({
      ...req.body,
      author: req.user!._id,
    });
    await news.populate('author', 'firstName lastName');
    res.status(201).json(news);
  } catch (error) {
    res.status(400).json({ message: 'Données invalides', error });
  }
});

// @desc    Téléverser une image de publication
// @route   POST /api/news/upload
// @access  Private
router.post(
  '/upload',
  protect,
  authorizePermissions('news.create', 'news.update'),
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
        message: 'Image de publication téléversée avec succès.',
        fileName: uploadedFile.filename,
        url: buildUploadedFileUrl(req, uploadedFile.filename),
      });
    });
  }
);

// @desc    Mettre à jour une actualité
// @route   PUT /api/news/:id
// @access  Private
router.put('/:id', protect, authorizePermissions('news.update'), async (req, res) => {
  try {
    const news = await News.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
      .populate('author', 'firstName lastName');
    if (news) {
      res.json(news);
    } else {
      res.status(404).json({ message: 'Actualité non trouvée' });
    }
  } catch (error) {
    res.status(400).json({ message: 'Données invalides', error });
  }
});

// @desc    Supprimer une actualité
// @route   DELETE /api/news/:id
// @access  Private
router.delete('/:id', protect, authorizePermissions('news.delete'), async (req, res) => {
  try {
    const news = await News.findByIdAndDelete(req.params.id);
    if (news) {
      res.json({ message: 'Actualité supprimée' });
    } else {
      res.status(404).json({ message: 'Actualité non trouvée' });
    }
  } catch (error) {
    res.status(400).json({ message: 'Erreur', error });
  }
});

export default router;
