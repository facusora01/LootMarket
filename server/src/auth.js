import { userRepository } from './repositories/userRepository.js';

// ISO 27001 A.8.28 (codificacion segura): el token de sesion viaja en una cookie
// HttpOnly (inaccesible para JS -> no se puede robar via XSS) con SameSite=Strict
// (mitiga CSRF). Se mantiene soporte de Bearer para clientes de API / tests.
export const SESSION_COOKIE = 'lm_session';
export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'strict',
  secure: process.env.NODE_ENV === 'production', // en prod exige HTTPS
  path: '/',
  maxAge: 8 * 60 * 60 * 1000, // 8h, igual que la sesion en DB
};

function readToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  const cookie = req.headers.cookie || '';
  const m = cookie.match(/(?:^|;\s*)lm_session=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export async function authenticate(req, res, next) {
  const token = readToken(req);
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
