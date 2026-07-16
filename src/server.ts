import connectDB from './config/db.js';
import app from './app.js';

const PORT = process.env.PORT || 5000;

// Connecter à la DB et lancer le serveur
connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Serveur backend lancé sur le port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('❌ Impossible de démarrer le backend :', error);
    process.exit(1);
  });
