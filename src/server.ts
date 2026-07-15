import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import connectDB from './config/db.js';
import authRoutes from './routes/auth.routes.js';
import staffRoutes from './routes/staff.routes.js';
import campaignRoutes from './routes/campaign.routes.js';
import donationRoutes from './routes/donation.routes.js';
import newsRoutes from './routes/news.routes.js';
import beneficiaryRoutes from './routes/beneficiary.routes.js';
import siteContentRoutes from './routes/site-content.routes.js';

// Initialiser l'app
const app = express();
const PORT = process.env.PORT || 5000;
const uploadsDirectory = path.resolve(process.cwd(), 'uploads');
const defaultAllowedOrigins = ['http://localhost:5173'];
const configuredOrigins = (process.env.FRONTEND_URLS || process.env.FRONTEND_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = [...new Set([...defaultAllowedOrigins, ...configuredOrigins])];

// Middlewares
app.set('trust proxy', 1);
app.use(
  helmet({
    // Autorise le frontend et le backend à partager les images uploadées
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
); // Sécuriser les headers HTTP
app.use(cors({
  origin: (origin, callback) => {
    // Permet les appels sans Origin (healthchecks, curl, Postman)
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`Origine non autorisée par CORS: ${origin}`));
  },
  credentials: true,
}));
app.use(morgan('dev')); // Log des requêtes
app.use(express.json({ limit: '10kb' })); // Parsing du corps des requêtes JSON
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); // Parsing des cookies
app.use('/uploads', express.static(uploadsDirectory));

// Limiteur de débit
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limiter à 100 requêtes par IP
  message: 'Trop de requêtes depuis cette IP, veuillez réessayer plus tard',
});
app.use('/api/', limiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/beneficiaries', beneficiaryRoutes);
app.use('/api/site-content', siteContentRoutes);

// Route de test
app.get('/', (_req, res) => {
  res.json({
    message: 'Bienvenue sur l\'API de la Fondation Bien Aimé Cassis !',
  });
});

// Gestion des erreurs 404
app.use('*', (_req, res) => {
  res.status(404).json({ message: 'Route non trouvée' });
});

// Gestion globale des erreurs
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Erreur serveur interne' });
});

// Connecter à la DB et lancer le serveur
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Serveur backend lancé sur le port ${PORT}`);
  });
});
