import { Router } from 'express';
import { listingRepository } from '../repositories/listingRepository.js';
import { authenticate, requireRole } from '../auth.js';

export const listingRoutes = Router();

const ALLOWED_CATEGORIES = ['all', 'account', 'skin', 'item', 'key'];
const ALLOWED_SORT_OPTIONS = ['recent', 'price-asc', 'price-desc'];

// Catalogo publico: emails enmascarados por la vista DDM (TP4)
// Modificado para capturar query params de paginación y filtros
listingRoutes.get('/', async (req, res, next) => {
  try {
    const limit = req.query.limit !== undefined ? parseInt(req.query.limit) : 12;
    const offset = req.query.offset !== undefined ? parseInt(req.query.offset) : 0;

    if (isNaN(limit) || limit < 0) {
      return res.status(400).json({ error: 'Parámetro limit inválido' });
    }
    if (isNaN(offset) || offset < 0) {
      return res.status(400).json({ error: 'Parámetro offset inválido' });
    }

    const category = req.query.category || 'all';
    if (!ALLOWED_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: 'Categoría inválida' });
    }

    const sort = req.query.sort || 'recent';
    if (!ALLOWED_SORT_OPTIONS.includes(sort)) {
      return res.status(400).json({ error: 'Parámetro sort inválido' });
    }

    const q = req.query.q || '';

    let minPrice = null;
    if (req.query.minPrice !== undefined && req.query.minPrice !== '') {
      minPrice = parseFloat(req.query.minPrice);
      if (isNaN(minPrice) || minPrice < 0) {
        return res.status(400).json({ error: 'Precio mínimo debe ser un número positivo' });
      }
    }

    let maxPrice = null;
    if (req.query.maxPrice !== undefined && req.query.maxPrice !== '') {
      maxPrice = parseFloat(req.query.maxPrice);
      if (isNaN(maxPrice) || maxPrice < 0) {
        return res.status(400).json({ error: 'Precio máximo debe ser un número positivo' });
      }
    }

    if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
      return res.status(400).json({ error: 'Precio mínimo no puede ser mayor al precio máximo' });
    }

    const result = await listingRepository.findAllPublicPaginated({ 
      limit, 
      offset, 
      category, 
      sort, 
      q, 
      minPrice, 
      maxPrice 
    });
    res.json(result); 
  } catch (err) { 
    next(err); 
  }
});

// Mis publicaciones (perfil): todos los estados, no solo 'active'. RLS deja al
// dueno ver sus propios listings (p_listings_select: seller_id = app_user_id()).
listingRoutes.get('/mine', authenticate, async (req, res, next) => {
  try { res.json(await listingRepository.findMine(req.user)); }
  catch (err) { next(err); }
});

listingRoutes.get('/:id', async (req, res, next) => {
  try {
    const listing = await listingRepository.findPublicById(req.params.id);
    if (!listing) return res.status(404).json({ error: 'No existe' });
    res.json(listing);
  } catch (err) { next(err); }
});

listingRoutes.post('/', authenticate, requireRole('user', 'admin'), async (req, res, next) => {
  try {
    const { title, category, description, price } = req.body;
    if (!title || !category || !price) {
      return res.status(400).json({ error: 'title, category y price requeridos' });
    }
    const listing = await listingRepository.create(req.user, { title, category, description: description || '', price });
    res.status(201).json(listing);
  } catch (err) { next(err); }
});

listingRoutes.patch('/:id/price', authenticate, requireRole('user', 'admin'), async (req, res, next) => {
  try {
    const updated = await listingRepository.updatePrice(req.user, req.params.id, req.body.price);
    if (!updated) return res.status(404).json({ error: 'Listing no encontrado o no editable' });
    res.json(updated);
  } catch (err) { next(err); }
});

listingRoutes.delete('/:id', authenticate, requireRole('user', 'admin'), async (req, res, next) => {
  try {
    const deleted = await listingRepository.remove(req.user, req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Listing no encontrado, no es tuyo o no está activo' });
    res.json({ ok: true, id: deleted.id });
  } catch (err) {
    // FK: un listing con transaccion asociada no se borra (no debería pasar con status='active')
    if (err.code === '23503') return res.status(409).json({ error: 'El listing tiene transacciones asociadas' });
    next(err);
  }
});