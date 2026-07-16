import mongoose from 'mongoose';

const connectDB = async (): Promise<void> => {
  if (mongoose.connection.readyState === 1) {
    return;
  }

  try {
    const mongoURI = process.env.MONGODB_URI as string;
    await mongoose.connect(mongoURI);
    console.log(`✅ MongoDB connecté: ${mongoose.connection.host}`);
  } catch (error) {
    console.error(`❌ Erreur de connexion à MongoDB: ${error}`);
    throw error;
  }
};

export default connectDB;
