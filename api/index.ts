import app from '../src/app.js';
import connectDB from '../src/config/db.js';

let isDatabaseReady = false;

export default async function handler(req: any, res: any) {
  if (!isDatabaseReady) {
    await connectDB();
    isDatabaseReady = true;
  }

  return app(req, res);
}
