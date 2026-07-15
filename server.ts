import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { createRequire } from "module";

const resolvedUrl = typeof import.meta !== "undefined" && import.meta.url
  ? import.meta.url
  : (typeof __filename !== "undefined" ? "file://" + __filename : "file://" + process.cwd() + "/server.js");

const myRequire = createRequire(resolvedUrl);

// Load dotenv
myRequire('dotenv').config();

async function startServer() {
  const app = express();
  const PORT = 3000; // MUST run on 3000

  // Apply cors
  const cors = myRequire('cors');
  app.use(cors());

  // JSON parsing with size limit
  app.use(express.json({ limit: '10mb' }));

  // Import DB pool to run load validation
  const pool = myRequire('./backend/db.js');

  // Load and mount backend routes
  const authRoutes = myRequire('./backend/routes/auth.js');
  const clientRoutes = myRequire('./backend/routes/clients.js');
  const productRoutes = myRequire('./backend/routes/products.js');
  const roomRoutes = myRequire('./backend/routes/rooms.js');
  const movementRoutes = myRequire('./backend/routes/movements.js');
  const locationRoutes = myRequire('./backend/routes/locations.js');
  const invoiceRoutes = myRequire('./backend/routes/invoices.js');
  const contractsRoutes = myRequire('./backend/routes/contracts.js');
  const settingsRoutes = myRequire('./backend/routes/settings.js');
  const paymentsRoutes = myRequire('./backend/routes/payments.js');

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
