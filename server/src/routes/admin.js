import { Router } from 'express';
import { auditRepository } from '../repositories/auditRepository.js';
import { authenticate, requireRole } from '../auth.js';

export const adminRoutes = Router();
adminRoutes.use(authenticate, requireRole('admin'));

// TP7: vista forense general
adminRoutes.get('/audit', async (req, res, next) => {
  try { res.json(await auditRepository.recent(req.user, Number(req.query.limit) || 100)); }
  catch (err) { next(err); }
});

// TP7: caso forense principal — rastreo completo de una transaccion disputada
adminRoutes.get('/audit/transaction/:id', async (req, res, next) => {
  try { res.json(await auditRepository.traceTransaction(req.user, Number(req.params.id))); }
  catch (err) { next(err); }
});
