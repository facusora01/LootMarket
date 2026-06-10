import { Router } from 'express';
import { disputeRepository } from '../repositories/disputeRepository.js';
import { authenticate, requireRole } from '../auth.js';

export const disputeRoutes = Router();
disputeRoutes.use(authenticate);

// Moderador lista disputas abiertas (solo metadatos, sin datos privados)
disputeRoutes.get('/', requireRole('moderator', 'admin'), async (req, res, next) => {
  try { res.json(await disputeRepository.listOpenSummaries(req.user)); }
  catch (err) { next(err); }
});

// TP8: solicitud de elevacion JIT — motivo obligatorio, expira en 15 min,
// queda registrada en audit_log
disputeRoutes.post('/:id/jit', requireRole('moderator'), async (req, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ error: 'Motivo de elevacion requerido (JIT)' });
    res.status(201).json(await disputeRepository.requestJit(req.user, req.params.id, reason));
  } catch (err) { next(err); }
});

// Detalle con datos privados: RLS devuelve 0 filas si no hay JIT vigente
// (o si no sos participante/admin)
disputeRoutes.get('/:id', async (req, res, next) => {
  try {
    const d = await disputeRepository.findByIdWithPrivateData(req.user, req.params.id);
    if (!d) {
      return res.status(403).json({
        error: 'Acceso denegado por RLS: necesitas grant JIT vigente o ser participante',
      });
    }
    res.json(d);
  } catch (err) { next(err); }
});

disputeRoutes.post('/:id/resolve', requireRole('moderator', 'admin'), async (req, res, next) => {
  try {
    const { winner, resolution } = req.body;
    if (!['buyer', 'seller'].includes(winner)) {
      return res.status(400).json({ error: "winner debe ser 'buyer' o 'seller'" });
    }
    const d = await disputeRepository.resolve(req.user, req.params.id, winner, resolution || '');
    if (!d) return res.status(403).json({ error: 'Sin JIT vigente o disputa no abierta' });
    res.json(d);
  } catch (err) { next(err); }
});
