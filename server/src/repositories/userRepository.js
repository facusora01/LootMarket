import crypto from 'node:crypto';
import { pool } from '../db.js';

// TP1: Repository pattern — la logica de negocio trata la persistencia como una
// coleccion; todo SQL parametrizado (TP5), nunca concatenacion.

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

export const userRepository = {
  // TP4: hash con pgcrypto crypt() + gen_salt('bf', 10) — one-way, con salt
  async create({ username, email, password, role }) {
    const { rows } = await pool.query(
      `INSERT INTO users (username, email, password_hash, role)
       VALUES ($1, $2, crypt($3, gen_salt('bf', 10)), $4)
       RETURNING id, username, email, role`,
      [username, email, password, role]
    );
    return rows[0];
  },

  // Login: crypt(input, hash_guardado) == hash_guardado
  async verifyCredentials(username, password) {
    const { rows } = await pool.query(
      `SELECT id, username, email, role, created_at
       FROM users
       WHERE username = $1 AND password_hash = crypt($2, password_hash)`,
      [username, password]
    );
    return rows[0] || null;
  },

  // TP4: el token viaja al cliente; en DB solo persiste su sha256
  async createSession(userId) {
    const token = crypto.randomBytes(32).toString('hex');
    await pool.query(
      `INSERT INTO sessions (user_id, token_hash, expires_at)
       VALUES ($1, $2, now() + interval '8 hours')`,
      [userId, sha256(token)]
    );
    return token;
  },

  async findBySessionToken(token) {
    const { rows } = await pool.query(
      `SELECT u.id, u.username, u.email, u.role, u.created_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND s.expires_at > now()`,
      [sha256(token)]
    );
    return rows[0] || null;
  },

  async deleteSession(token) {
    await pool.query('DELETE FROM sessions WHERE token_hash = $1', [sha256(token)]);
  },
};
