import express from 'express';
import cors from 'cors';
import { authRoutes } from './routes/auth.js';
import { listingRoutes } from './routes/listings.js';
import { transactionRoutes } from './routes/transactions.js';
import { disputeRoutes } from './routes/disputes.js';
import { adminRoutes } from './routes/admin.js';
import { paymentRoutes } from './routes/payments.js';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/disputes', disputeRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payment-methods', paymentRoutes);

// Errores: nunca filtrar detalles internos del motor al cliente (TP5: defensa en profundidad)
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`LootMarket API en http://localhost:${PORT}`));
