import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth.routes.js';
import staffRoutes from './routes/staff.routes.js';
import campaignRoutes from './routes/campaign.routes.js';
import newsRoutes from './routes/news.routes.js';
import beneficiaryRoutes from './routes/beneficiary.routes.js';
import siteContentRoutes from './routes/site-content.routes.js';
import userRoutes from './routes/user.routes.js';
import adminProfileRoutes from './routes/admin-profile.routes.js';
import adminManagementRoutes from './routes/admin-management.routes.js';
import moduleDonationRoutes from './modules/donations/donation.routes.js';
import paymentRoutes from './modules/payments/payment.routes.js';
import { getUploadsDirectory } from './utils/uploads-directory.js';

const app = express();
const uploadsDirectory = getUploadsDirectory();
const defaultAllowedOrigins = ['http://localhost:5173'];
const configuredOrigins = (process.env.FRONTEND_URLS || process.env.FRONTEND_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = [...new Set([...defaultAllowedOrigins, ...configuredOrigins])];

app.set('trust proxy', 1);
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`Origine non autorisée par CORS: ${origin}`));
    },
    credentials: true,
  })
);
app.use(morgan('dev'));
// The content editor sends a large nested JSON document for the whole public site.
// 10kb is too restrictive and causes body-parser to throw before the route handler runs.
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());
app.use('/uploads', express.static(uploadsDirectory));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Trop de requêtes depuis cette IP, veuillez réessayer plus tard',
});
app.use('/api/', limiter);

app.use('/api/auth', authRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/beneficiaries', beneficiaryRoutes);
app.use('/api/site-content', siteContentRoutes);
app.use('/api', moduleDonationRoutes);
app.use('/api', paymentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin/profile', adminProfileRoutes);
app.use('/api/admin', adminManagementRoutes);

app.get('/', (_req, res) => {
  res.json({
    message: "Bienvenue sur l'API de la Fondation Bien Aimé Cassis !",
  });
});

app.use('*', (_req, res) => {
  res.status(404).json({ message: 'Route non trouvée' });
});

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({
      message: 'Le contenu envoyé dépasse la taille maximale autorisée.',
    });
  }

  console.error(err.stack);
  res.status(500).json({ message: 'Erreur serveur interne' });
});

export default app;
