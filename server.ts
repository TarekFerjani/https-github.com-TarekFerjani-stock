import express from "express";
import path from "path";
import cors from "cors";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { createRequire } from "module";

// Declare require so TypeScript compiler is happy
declare const require: any;

const resolvedUrl = typeof import.meta !== "undefined" && import.meta.url
  ? import.meta.url
  : "file://" + process.cwd() + "/server.js";

const myRequire = typeof require !== "undefined"
  ? require
  : createRequire(resolvedUrl);

// Load dotenv
dotenv.config();

// Import DB pool to run load validation with absolute path
const pool = myRequire(path.join(process.cwd(), "backend/db.js"));

// Load and mount backend routes with absolute path
const authRoutes = myRequire(path.join(process.cwd(), "backend/routes/auth.js"));
const clientRoutes = myRequire(path.join(process.cwd(), "backend/routes/clients.js"));
const productRoutes = myRequire(path.join(process.cwd(), "backend/routes/products.js"));
const roomRoutes = myRequire(path.join(process.cwd(), "backend/routes/rooms.js"));
const movementRoutes = myRequire(path.join(process.cwd(), "backend/routes/movements.js"));
const locationRoutes = myRequire(path.join(process.cwd(), "backend/routes/locations.js"));
const invoiceRoutes = myRequire(path.join(process.cwd(), "backend/routes/invoices.js"));
const contractsRoutes = myRequire(path.join(process.cwd(), "backend/routes/contracts.js"));
const settingsRoutes = myRequire(path.join(process.cwd(), "backend/routes/settings.js"));
const paymentsRoutes = myRequire(path.join(process.cwd(), "backend/routes/payments.js"));

async function startServer() {
  const app = express();
  const PORT = 3000; // MUST run on 3000

  // Apply cors
  app.use(cors());

  // JSON parsing with size limit
  app.use(express.json({ limit: '10mb' }));

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
