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
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));
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

app.get('/', (_req, res) => {
  res.json({
    message: "Bienvenue sur l'API de la Fondation Bien Aimé Cassis !",
  });
});

app.use('*', (_req, res) => {
  res.status(404).json({ message: 'Route non trouvée' });
});

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Erreur serveur interne' });
});

export default app;
