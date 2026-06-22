import { withUserContext } from '../db.js';

export const auditRepository = {
  // TP7: reconstruccion forense de una transaccion disputada.
  // Devuelve la cadena completa: listado del item, compra, transferencia,
  // disputas y toda modificacion posterior de precio/estado, con before/after
  // image y actor de cada operacion.
  // Corre con el contexto del admin: la subquery sobre disputes pasa por RLS.
  // LM-59: N+1 verificado — 1 query con subqueries, sin loop fetching
  async traceTransaction(user, txId) {
    return withUserContext(user, async (client) => {
      const { rows } = await client.query(
        `SELECT a.id, a.table_name, a.operation, a.row_id, a.actor_id,
                a.before_img, a.after_img, a.at
         FROM audit_log a
         WHERE (a.table_name = 'transactions' AND a.row_id = $1)
            OR (a.table_name = 'item_transfers' AND (a.after_img->>'transaction_id')::int = $1)
            OR (a.table_name = 'disputes' AND (COALESCE(a.after_img, a.before_img)->>'transaction_id')::int = $1)
            OR (a.table_name = 'listings' AND a.row_id = (
                  SELECT listing_id FROM transactions WHERE id = $1))
            OR (a.table_name = 'jit_grants' AND (a.after_img->>'dispute_id')::int IN (
                  SELECT id FROM disputes WHERE transaction_id = $1))
         ORDER BY a.at, a.id`,
        [txId]
      );
      return rows;
    });
  },

  async recent(user, limit = 100) {
    return withUserContext(user, async (client) => {
      const { rows } = await client.query(
        `SELECT id, table_name, operation, row_id, actor_id, before_img, after_img, at
         FROM audit_log ORDER BY id DESC LIMIT $1`,
        [limit]
      );
      return rows;
    });
  },
};
