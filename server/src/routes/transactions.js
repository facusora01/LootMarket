import { Router } from 'express';
import { transactionRepository } from '../repositories/transactionRepository.js';
import { disputeRepository } from '../repositories/disputeRepository.js';
import { authenticate } from '../auth.js';

export const transactionRoutes = Router();
transactionRoutes.use(authenticate);

transactionRoutes.get('/mine', async (req, res, next) => {
  try { res.json(await transactionRepository.findByUser(req.user)); }
  catch (err) { next(err); }
});

// Comprar = abrir escrow
transactionRoutes.post('/', async (req, res, next) => {
  try {
    const tx = await transactionRepository.createEscrow(req.user, req.body.listingId);
    if (!tx) return res.status(409).json({ error: 'Listing no disponible (o es tuyo)' });
    res.status(201).json(tx);
  } catch (err) { next(err); }
});

transactionRoutes.post('/:id/transfer', async (req, res, next) => {
  try {
    const tx = await transactionRepository.markTransferred(req.user, req.params.id, req.body.note);
    if (!tx) return res.status(409).json({ error: 'No sos el vendedor o estado invalido' });
    res.json(tx);
  } catch (err) { next(err); }
});

transactionRoutes.post('/:id/release', async (req, res, next) => {
  try {
    const tx = await transactionRepository.release(req.user, req.params.id);
    if (!tx) return res.status(409).json({ error: 'No sos el comprador o estado invalido' });
    res.json(tx);
  } catch (err) { next(err); }
});

transactionRoutes.post('/:id/dispute', async (req, res, next) => {
  try {
    const { reason, privateAccountData } = req.body;
    if (!reason) return res.status(400).json({ error: 'reason requerido' });
    const d = await disputeRepository.open(req.user, req.params.id, reason, privateAccountData);
    if (!d) return res.status(409).json({ error: 'Transaccion no disputable' });
    res.status(201).json(d);
  } catch (err) { next(err); }
});
