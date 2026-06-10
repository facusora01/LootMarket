import { Router } from 'express';
import { listingRepository } from '../repositories/listingRepository.js';
import { authenticate, requireRole } from '../auth.js';

export const listingRoutes = Router();

// Catalogo publico: emails enmascarados por la vista DDM (TP4)
listingRoutes.get('/', async (_req, res, next) => {
  try { res.json(await listingRepository.findAllPublic()); }
  catch (err) { next(err); }
});

listingRoutes.get('/:id', async (req, res, next) => {
  try {
    const listing = await listingRepository.findPublicById(req.params.id);
    if (!listing) return res.status(404).json({ error: 'No existe' });
    res.json(listing);
  } catch (err) { next(err); }
});

listingRoutes.post('/', authenticate, requireRole('seller', 'admin'), async (req, res, next) => {
  try {
    const { title, category, description, price } = req.body;
    if (!title || !category || !price) {
      return res.status(400).json({ error: 'title, category y price requeridos' });
    }
    const listing = await listingRepository.create(req.user, { title, category, description: description || '', price });
    res.status(201).json(listing);
  } catch (err) { next(err); }
});

listingRoutes.patch('/:id/price', authenticate, requireRole('seller'), async (req, res, next) => {
  try {
    const updated = await listingRepository.updatePrice(req.user, req.params.id, req.body.price);
    if (!updated) return res.status(404).json({ error: 'Listing no encontrado o no editable' });
    res.json(updated);
  } catch (err) { next(err); }
});
