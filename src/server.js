import 'dotenv/config';
import app from './index.js';
import { testConnection } from './db/connection.js';
const PORT = process.env.PORT || 3000;


(async () => {
  const connected = await testConnection();
  if (!connected) {
    console.error('⚠️  No se pudo conectar a la base de datos. El servidor no arrancará.');
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
  });
})();