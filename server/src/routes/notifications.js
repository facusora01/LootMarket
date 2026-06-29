import { Router } from 'express';
import { notificationRepository } from '../repositories/notificationRepository.js';
import { authenticate } from '../auth.js';

export const notificationRoutes = Router();
notificationRoutes.use(authenticate);

// Mis notificaciones + contador de no leídas
notificationRoutes.get('/', async (req, res, next) => {
  try { res.json(await notificationRepository.listMine(req.user)); }
  catch (err) { next(err); }
});

notificationRoutes.post('/:id/read', async (req, res, next) => {
  try {
    const n = await notificationRepository.markRead(req.user, req.params.id);
    if (!n) return res.status(404).json({ error: 'Notificación no encontrada' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

notificationRoutes.post('/read-all', async (req, res, next) => {
  try {
    const count = await notificationRepository.markAllRead(req.user);
    res.json({ ok: true, count });
  } catch (err) { next(err); }
});
