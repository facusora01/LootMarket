import { pool, withUserContext } from '../db.js';

export const listingRepository = {
  // TP4: catalogo publico siempre via vista con DDM — email del vendedor enmascarado
  async findAllPublic() {
    const { rows } = await pool.query(
      `SELECT * FROM v_listings_public WHERE status = 'active' ORDER BY created_at DESC`
    );
    return rows;
  },

  async findPublicById(id) {
    const { rows } = await pool.query(
      'SELECT * FROM v_listings_public WHERE id = $1',
      [id]
    );
    return rows[0] || null;
  },

  async create(user, { title, category, description, price }) {
    return withUserContext(user, async (client) => {
      const { rows } = await client.query(
        `INSERT INTO listings (seller_id, title, category, description, price)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [user.id, title, category, description, price]
      );
      return rows[0];
    });
  },

  // Cambio de precio/estado queda en audit_log con before/after image (TP7)
  async updatePrice(user, listingId, price) {
    return withUserContext(user, async (client) => {
      const { rows } = await client.query(
        `UPDATE listings SET price = $1, updated_at = now()
         WHERE id = $2 AND seller_id = $3 AND status = 'active'
         RETURNING *`,
        [price, listingId, user.id]
      );
      return rows[0] || null;
    });
  },
};
