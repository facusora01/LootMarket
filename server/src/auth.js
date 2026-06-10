import { userRepository } from './repositories/userRepository.js';

export async function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No autenticado' });
  const user = await userRepository.findBySessionToken(token);
  if (!user) return res.status(401).json({ error: 'Sesion invalida o expirada' });
  req.user = user;
  req.token = token;
  next();
}

// RBAC en la capa de aplicacion (TP3). Para disputas se suma ABAC en la DB:
// el rol solo no alcanza, RLS exige el grant JIT vigente.
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Rol insuficiente' });
    }
    next();
  };
}
