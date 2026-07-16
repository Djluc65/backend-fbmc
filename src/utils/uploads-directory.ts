import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const isServerlessRuntime = Boolean(
  process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT
);

export const getUploadsDirectory = () => {
  const configuredDirectory = process.env.UPLOADS_DIR?.trim();

  if (configuredDirectory) {
    return configuredDirectory;
  }

  if (isServerlessRuntime) {
    return path.join(os.tmpdir(), 'fondation-bien-aime-cassis', 'uploads');
  }

  return path.resolve(process.cwd(), 'uploads');
};

export const ensureUploadsDirectory = async () => {
  const uploadsDirectory = getUploadsDirectory();
  await fs.mkdir(uploadsDirectory, { recursive: true });
  return uploadsDirectory;
};
