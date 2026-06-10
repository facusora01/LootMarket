import { Router } from 'express';
import { paymentRepository } from '../repositories/paymentRepository.js';
import { authenticate } from '../auth.js';

export const paymentRoutes = Router();
paymentRoutes.use(authenticate);

paymentRoutes.get('/', async (req, res, next) => {
  try { res.json(await paymentRepository.listMine(req.user)); }
  catch (err) { next(err); }
});

// TP4: la tarjeta se cifra en reposo (pgp_sym_encrypt); la API solo devuelve last4
paymentRoutes.post('/', async (req, res, next) => {
  try {
    const card = String(req.body.cardNumber || '').replace(/\D/g, '');
    if (card.length < 13 || card.length > 19) {
      return res.status(400).json({ error: 'Numero de tarjeta invalido' });
    }
    res.status(201).json(await paymentRepository.add(req.user, card));
  } catch (err) { next(err); }
});
