import { Router } from 'express';
import { userRepository } from '../repositories/userRepository.js';
import { authenticate } from '../auth.js';

export const authRoutes = Router();

authRoutes.post('/register', async (req, res, next) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Todos los campos son requeridos (usuario, email y contraseña)' });
    }

    const trimmedUsername = String(username).trim();
    const trimmedEmail = String(email).trim().toLowerCase();

    if (trimmedUsername.length < 3) {
      return res.status(400).json({ error: 'El nombre de usuario debe tener al menos 3 caracteres' });
    }
    if (trimmedUsername.length > 50) {
      return res.status(400).json({ error: 'El nombre de usuario no puede exceder los 50 caracteres' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return res.status(400).json({ error: 'El formato de email no es válido' });
    }

    if (String(password).length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    // Registro publico crea siempre cuenta 'user' (compra y vende).
    // moderador/admin se crean por seed/admin, nunca por signup.
    const user = await userRepository.create({
      username: trimmedUsername,
      email: trimmedEmail,
      password,
      role: 'user',
    });
    
    const token = await userRepository.createSession(user.id);
    res.status(201).json({ user, token });
  } catch (err) {
    if (err.code === '23505') {
      if (err.constraint === 'users_username_key') {
        return res.status(409).json({ error: 'El nombre de usuario ya está registrado' });
      }
      if (err.constraint === 'users_email_key') {
        return res.status(409).json({ error: 'El email ya está registrado' });
      }
      return res.status(409).json({ error: 'Usuario o email ya existe' });
    }
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
