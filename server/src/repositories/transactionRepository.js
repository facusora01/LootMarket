import { withUserContext } from '../db.js';

export const transactionRepository = {
  // Compra = escrow: el monto queda retenido, el listing pasa a in_escrow.
  // Todo en UNA transaccion SQL (atomicidad) y auditado por triggers (TP7).
  async createEscrow(user, listingId) {
    return withUserContext(user, async (client) => {
      const { rows: lrows } = await client.query(
        `UPDATE listings SET status = 'in_escrow', updated_at = now()
         WHERE id = $1 AND status = 'active' AND seller_id <> $2
         RETURNING id, seller_id, price`,
        [listingId, user.id]
      );
      if (!lrows[0]) return null;
      const l = lrows[0];
      const { rows } = await client.query(
        `INSERT INTO transactions (listing_id, buyer_id, seller_id, amount)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [l.id, user.id, l.seller_id, l.price]
      );
      return rows[0];
    });
  },

  // Vendedor marca el item como transferido — hecho forense independiente (TP7)
  async markTransferred(user, txId, note) {
    return withUserContext(user, async (client) => {
      const { rows } = await client.query(
        `UPDATE transactions SET status = 'item_transferred', updated_at = now()
         WHERE id = $1 AND seller_id = $2 AND status = 'escrow_held'
         RETURNING *`,
        [txId, user.id]
      );
      if (!rows[0]) return null;
      await client.query(
        `INSERT INTO item_transfers (transaction_id, transferred_by, note)
         VALUES ($1, $2, $3)`,
        [txId, user.id, note || '']
      );
      return rows[0];
    });
  },

  // Comprador confirma recepcion: se libera el escrow al vendedor
  async release(user, txId) {
    return withUserContext(user, async (client) => {
      const { rows } = await client.query(
        `UPDATE transactions SET status = 'released', updated_at = now()
         WHERE id = $1 AND buyer_id = $2 AND status = 'item_transferred'
         RETURNING *`,
        [txId, user.id]
      );
      if (!rows[0]) return null;
      await client.query(
        `UPDATE listings SET status = 'sold', updated_at = now() WHERE id = $1`,
        [rows[0].listing_id]
      );
      return rows[0];
    });
  },

  // LM-59: N+1 verificado — 1 query con JOIN, sin loop fetching
  async findByUser(user) {
    return withUserContext(user, async (client) => {
      const { rows } = await client.query(
        `SELECT t.*, l.title AS listing_title
         FROM transactions t JOIN listings l ON l.id = t.listing_id
         WHERE t.buyer_id = $1 OR t.seller_id = $1
         ORDER BY t.created_at DESC`,
        [user.id]
      );
      return rows;
    });
  },
};
