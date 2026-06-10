import { Router } from 'express';
import { userRepository } from '../repositories/userRepository.js';
import { authenticate } from '../auth.js';

export const authRoutes = Router();

authRoutes.post('/register', async (req, res, next) => {
  try {
    const { username, email, password, role } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'username, email y password requeridos' });
    }
    // Solo buyer/seller via registro publico; moderador y admin se crean por seed/admin
    const safeRole = ['buyer', 'seller'].includes(role) ? role : 'buyer';
    const user = await userRepository.create({ username, email, password, role: safeRole });
    const token = await userRepository.createSession(user.id);
    res.status(201).json({ user, token });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Usuario o email ya existe' });
    next(err);
  }
});

authRoutes.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const user = await userRepository.verifyCredentials(username, password);
    if (!user) return res.status(401).json({ error: 'Credenciales invalidas' });
    const token = await userRepository.createSession(user.id);
    res.json({ user, token });
  } catch (err) { next(err); }
});

authRoutes.post('/logout', authenticate, async (req, res, next) => {
  try {
    await userRepository.deleteSession(req.token);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

authRoutes.get('/me', authenticate, (req, res) => res.json({ user: req.user }));
