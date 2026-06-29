import { Router } from 'express';
import { userRepository } from '../repositories/userRepository.js';
import { authenticate } from '../auth.js';

export const authRoutes = Router();

// ISO 27001 A.8.5 (autenticacion segura) + A.8.16 (monitoreo de actividades):
// limita intentos de login por IP+usuario y registra los fallos. Mitiga fuerza
// bruta y credential stuffing. In-memory: suficiente para una sola instancia;
// en prod se usaria Redis o un WAF.
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 min
const LOGIN_MAX_ATTEMPTS = 10;
const loginAttempts = new Map(); // key -> { count, firstAt }

function loginRateLimit(req, res, next) {
  const key = `${req.ip}:${String(req.body?.username || '').toLowerCase()}`;
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (entry && now - entry.firstAt < LOGIN_WINDOW_MS) {
    if (entry.count >= LOGIN_MAX_ATTEMPTS) {
      console.warn(`[SECURITY] login bloqueado por rate-limit: ${key}`);
      return res.status(429).json({ error: 'Demasiados intentos. Probá de nuevo en unos minutos.' });
    }
  } else {
    loginAttempts.set(key, { count: 0, firstAt: now });
  }
  req._loginKey = key;
  next();
}

function recordLoginFailure(key) {
  const entry = loginAttempts.get(key);
  if (entry) entry.count += 1;
  console.warn(`[SECURITY] intento de login fallido: ${key}`);
}

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

authRoutes.post('/login', loginRateLimit, async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const user = await userRepository.verifyCredentials(username, password);
    if (!user) {
      recordLoginFailure(req._loginKey);
      return res.status(401).json({ error: 'Credenciales invalidas' });
    }
    // Login exitoso: limpiar el contador de intentos.
    loginAttempts.delete(req._loginKey);
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
