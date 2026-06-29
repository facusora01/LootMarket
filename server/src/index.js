import './env.js'; // carga server/.env antes que cualquier modulo que lea process.env
import express from 'express';
import cors from 'cors';
import { authRoutes } from './routes/auth.js';
import { listingRoutes } from './routes/listings.js';
import { transactionRoutes } from './routes/transactions.js';
import { disputeRoutes } from './routes/disputes.js';
import { adminRoutes } from './routes/admin.js';
import { paymentRoutes } from './routes/payments.js';
import { notificationRoutes } from './routes/notifications.js';

const app = express();

// ISO 27001 A.8.9 (hardening): no revelar el stack del servidor.
app.disable('x-powered-by');

// ISO 27001 A.8.20/A.8.23 (seguridad de red): CORS restringido a origenes
// conocidos en vez de '*'. Configurable por env para prod.
const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim());
app.use(cors({
  origin: (origin, cb) => {
    // Permitir herramientas sin Origin (curl, tests) y los origenes en allowlist.
    // Origen no permitido: no se setea Access-Control-Allow-Origin (el browser
    // bloquea la lectura cross-origin) sin lanzar 500.
    cb(null, !origin || ALLOWED_ORIGINS.includes(origin));
  },
  credentials: true, // permite el envio de la cookie de sesion (V8)
}));

// ISO 27001 A.8.9: cabeceras de seguridad basicas (sin dependencias extra).
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/disputes', disputeRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payment-methods', paymentRoutes);
app.use('/api/notifications', notificationRoutes);

// Errores: nunca filtrar detalles internos del motor al cliente (TP5: defensa en profundidad)
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`LootMarket API en http://localhost:${PORT}`));
