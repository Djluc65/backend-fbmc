import mongoose from 'mongoose';

const connectDB = async (): Promise<void> => {
  try {
    const mongoURI = process.env.MONGODB_URI as string;
    await mongoose.connect(mongoURI);
    console.log(`✅ MongoDB connecté: ${mongoose.connection.host}`);
  } catch (error) {
    console.error(`❌ Erreur de connexion à MongoDB: ${error}`);
    process.exit(1);
  }
};

export default connectDB;
