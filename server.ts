import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load dotenv
require('dotenv').config();

async function startServer() {
  const app = express();
  const PORT = 3000; // MUST run on 3000

  // Apply cors
  const cors = require('cors');
  app.use(cors());

  // JSON parsing with size limit
  app.use(express.json({ limit: '10mb' }));

  // Import DB pool to run load validation
  const pool = require('./backend/db.js');

  // Load and mount backend routes
  const authRoutes = require('./backend/routes/auth.js');
  const clientRoutes = require('./backend/routes/clients.js');
  const productRoutes = require('./backend/routes/products.js');
  const roomRoutes = require('./backend/routes/rooms.js');
  const movementRoutes = require('./backend/routes/movements.js');
  const locationRoutes = require('./backend/routes/locations.js');
  const invoiceRoutes = require('./backend/routes/invoices.js');
  const contractsRoutes = require('./backend/routes/contracts.js');
  const settingsRoutes = require('./backend/routes/settings.js');
  const paymentsRoutes = require('./backend/routes/payments.js');

  // Register API routes
  app.use('/api', authRoutes);
  app.use('/api/clients', clientRoutes);
  app.use('/api/products', productRoutes);
  app.use('/api/rooms', roomRoutes);
  app.use('/api/movements', movementRoutes);
  app.use('/api/locations', locationRoutes);
  app.use('/api/invoices', invoiceRoutes);
  app.use('/api/contracts', contractsRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/payments', paymentsRoutes);

  // DB verify
  try {
    const client = await pool.connect();
    console.log('✓ DB Pool verification complete.');
    client.release();
  } catch (error: any) {
    console.error('Database connection error:', error.message);
  }

  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // For Express 5, we must use '*all' as per guidelines
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
