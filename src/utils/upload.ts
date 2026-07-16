import fs from 'node:fs';
import path from 'node:path';
import type { Request } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';

const uploadsDirectory = path.resolve(process.cwd(), 'uploads');

if (!fs.existsSync(uploadsDirectory)) {
  fs.mkdirSync(uploadsDirectory, { recursive: true });
}

const allowedImageMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
]);

const allowedProofMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

const extensionByMimeType: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
  'application/pdf': '.pdf',
};

const cloudinaryUrl = process.env.CLOUDINARY_URL?.trim();
const parseCloudinaryUrl = (value?: string | null) => {
  if (!value) {
    return null;
  }

  try {
    const parsedUrl = new URL(value);

    if (parsedUrl.protocol !== 'cloudinary:') {
      return null;
    }

    return {
      cloudName: parsedUrl.hostname || undefined,
      apiKey: parsedUrl.username || undefined,
      apiSecret: parsedUrl.password || undefined,
    };
  } catch {
    return null;
  }
};

const parsedCloudinaryUrl = parseCloudinaryUrl(cloudinaryUrl);
const cloudinaryCloudName =
  process.env.CLOUDINARY_CLOUD_NAME?.trim() || parsedCloudinaryUrl?.cloudName;
const cloudinaryApiKey = process.env.CLOUDINARY_API_KEY?.trim() || parsedCloudinaryUrl?.apiKey;
const cloudinaryApiSecret =
  process.env.CLOUDINARY_API_SECRET?.trim() || parsedCloudinaryUrl?.apiSecret;
const cloudinaryBaseFolder = process.env.CLOUDINARY_FOLDER?.trim();
const isCloudinaryConfigured = Boolean(
  cloudinaryCloudName && cloudinaryApiKey && cloudinaryApiSecret
);

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: cloudinaryCloudName,
    api_key: cloudinaryApiKey,
    api_secret: cloudinaryApiSecret,
    secure: true,
  });
} else if (cloudinaryUrl || cloudinaryCloudName || cloudinaryApiKey || cloudinaryApiSecret) {
  console.warn(
    '[upload] Configuration Cloudinary incomplète, bascule vers le stockage local /uploads.'
  );
}

const sanitizeSegment = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

const getSafeFolder = (req: Request) => {
  const folder = typeof req.body.folder === 'string' ? req.body.folder : 'site';

  return sanitizeSegment(folder) || 'site';
};

const createStoredFilename = (
  req: Request,
  file: Pick<Express.Multer.File, 'mimetype' | 'originalname'>
) => {
  const safeFolder = getSafeFolder(req);
  const extension = extensionByMimeType[file.mimetype] ?? path.extname(file.originalname) ?? '.bin';
  const baseName = sanitizeSegment(path.parse(file.originalname).name) || 'image';
  const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;

  return `${safeFolder}-${baseName}-${uniqueSuffix}${extension}`;
};

export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, callback) => {
    if (!allowedImageMimeTypes.has(file.mimetype)) {
      callback(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
      return;
    }

    callback(null, true);
  },
});

export const paymentProofUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, callback) => {
    const originalExtension = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.pdf']);

    if (!allowedProofMimeTypes.has(file.mimetype) || !allowedExtensions.has(originalExtension)) {
      callback(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
      return;
    }

    callback(null, true);
  },
});

const uploadBufferToCloudinary = (
  fileBuffer: Buffer,
  options: {
    folder?: string;
    publicId: string;
    resourceType?: 'image' | 'raw';
  }
) =>
  new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder,
        public_id: options.publicId,
        resource_type: options.resourceType ?? 'image',
      },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error('Upload Cloudinary impossible'));
          return;
        }

        resolve({
          secure_url: result.secure_url,
          public_id: result.public_id,
        });
      }
    );

    uploadStream.end(fileBuffer);
  });

export const storeUploadedImage = async (req: Request, file: Express.Multer.File) => {
  const fileName = createStoredFilename(req, file);

  if (isCloudinaryConfigured) {
    const publicId = path.parse(fileName).name;
    const folder = [cloudinaryBaseFolder, getSafeFolder(req)].filter(Boolean).join('/');
    const result = await uploadBufferToCloudinary(file.buffer, {
      folder: folder || undefined,
      publicId,
    });

    return {
      fileName: result.public_id,
      url: result.secure_url,
      storageProvider: 'cloudinary' as const,
    };
  }

  await fs.promises.writeFile(path.resolve(uploadsDirectory, fileName), file.buffer);

  return {
    fileName,
    url: buildUploadedFileUrl(req, fileName),
    storageProvider: 'local' as const,
  };
};

export const storeUploadedProof = async (req: Request, file: Express.Multer.File) => {
  const fileName = createStoredFilename(req, file);

  if (isCloudinaryConfigured) {
    const publicId = path.parse(fileName).name;
    const folder = [cloudinaryBaseFolder, getSafeFolder(req)].filter(Boolean).join('/');
    const result = await uploadBufferToCloudinary(file.buffer, {
      folder: folder || undefined,
      publicId,
      resourceType: file.mimetype === 'application/pdf' ? 'raw' : 'image',
    });

    return {
      fileName: result.public_id,
      publicId: result.public_id,
      url: result.secure_url,
      storageProvider: 'cloudinary' as const,
    };
  }

  await fs.promises.writeFile(path.resolve(uploadsDirectory, fileName), file.buffer);

  return {
    fileName,
    publicId: fileName,
    url: buildUploadedFileUrl(req, fileName),
    storageProvider: 'local' as const,
  };
};

export const deleteStoredAsset = async (target?: {
  publicId?: string | null;
  fileUrl?: string | null;
  mimeType?: string | null;
}) => {
  if (!target?.publicId && !target?.fileUrl) {
    return;
  }

  if (isCloudinaryConfigured && target.publicId) {
    const publicId = target.publicId;
    const resourceType = target.mimeType === 'application/pdf' ? 'raw' : 'image';

    await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      invalidate: true,
    });
    return;
  }

  if (target.fileUrl) {
    const parsedUrl = new URL(target.fileUrl, 'http://localhost');
    const fileName = path.basename(parsedUrl.pathname);
    const localPath = path.resolve(uploadsDirectory, fileName);

    if (fs.existsSync(localPath)) {
      await fs.promises.unlink(localPath);
    }
  }
};

export const buildUploadedFileUrl = (req: Request, filename: string) => {
  const configuredBaseUrl = process.env.PUBLIC_BACKEND_URL?.trim().replace(/\/$/, '');
  const requestBaseUrl = `${req.protocol}://${req.get('host')}`;
  const baseUrl = configuredBaseUrl || requestBaseUrl;

  return `${baseUrl}/uploads/${filename}`;
};
