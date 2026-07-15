import fs from 'node:fs';
import path from 'node:path';
import type { Request } from 'express';
import multer from 'multer';

const uploadsDirectory = path.resolve(process.cwd(), 'uploads');

if (!fs.existsSync(uploadsDirectory)) {
  fs.mkdirSync(uploadsDirectory, { recursive: true });
}

const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
]);

const extensionByMimeType: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
};

const sanitizeSegment = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, uploadsDirectory);
  },
  filename: (req, file, callback) => {
    const folder = typeof req.body.folder === 'string' ? req.body.folder : 'site';
    const safeFolder = sanitizeSegment(folder) || 'site';
    const extension = extensionByMimeType[file.mimetype] ?? path.extname(file.originalname) ?? '.bin';
    const baseName = sanitizeSegment(path.parse(file.originalname).name) || 'image';
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;

    callback(null, `${safeFolder}-${baseName}-${uniqueSuffix}${extension}`);
  },
});

export const imageUpload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      callback(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
      return;
    }

    callback(null, true);
  },
});

export const buildUploadedFileUrl = (req: Request, filename: string) => {
  const configuredBaseUrl = process.env.PUBLIC_BACKEND_URL?.trim().replace(/\/$/, '');
  const requestBaseUrl = `${req.protocol}://${req.get('host')}`;
  const baseUrl = configuredBaseUrl || requestBaseUrl;

  return `${baseUrl}/uploads/${filename}`;
};
