import { withUserContext } from '../db.js';
import { notificationRepository } from './notificationRepository.js';

export const disputeRepository = {
  // Participante abre disputa: la transaccion pasa a 'disputed'
  async open(user, txId, reason, privateAccountData) {
    return withUserContext(user, async (client) => {
      const { rows: trows } = await client.query(
        `UPDATE transactions SET status = 'disputed', updated_at = now()
         WHERE id = $1 AND (buyer_id = $2 OR seller_id = $2)
           AND status IN ('escrow_held', 'item_transferred')
         RETURNING id, buyer_id, seller_id, listing_id`,
        [txId, user.id]
      );
      if (!trows[0]) return null;
      const t = trows[0];
      const { rows } = await client.query(
        `INSERT INTO disputes (transaction_id, opened_by, reason, private_account_data)
         VALUES ($1, $2, $3, $4) RETURNING id, transaction_id, status, created_at`,
        [txId, user.id, reason, privateAccountData || '']
      );
      // Notificar a la contraparte (el que no abrio la disputa).
      const counterparty = user.id === t.buyer_id ? t.seller_id : t.buyer_id;
      const { rows: lr } = await client.query('SELECT title FROM listings WHERE id = $1', [t.listing_id]);
      await notificationRepository.notify(client, counterparty, 'dispute_opened',
        `Se abrió una disputa en «${lr[0]?.title || 'una transacción'}». Un moderador la revisará.`, '/transactions');
      return rows[0];
    });
  },

  // Listado para moderadores: solo metadatos, SIN datos privados.
  // Vista RBAC basica; el detalle requiere JIT (TP8).
  // LM-59: N+1 verificado — 1 query con EXISTS subquery, sin loop fetching
  async listOpenSummaries(user) {
    return withUserContext(user, async (client) => {
      const { rows } = await client.query(
        `SELECT d.id, d.transaction_id, d.status, d.created_at,
                EXISTS (
                  SELECT 1 FROM jit_grants g
                  WHERE g.dispute_id = d.id AND g.moderator_id = $1
                    AND NOT g.revoked AND g.expires_at > now()
                ) AS has_active_jit
         FROM disputes_summary d
         WHERE d.status = 'open'
         ORDER BY d.created_at`,
        [user.id]
      );
      return rows;
    });
  },

  // TP8: elevacion JIT — acceso temporal (15 min), acotado a UNA disputa,
  // con motivo declarado. Queda auditado (trigger sobre jit_grants).
  async requestJit(user, disputeId, reason) {
    return withUserContext(user, async (client) => {
      const { rows } = await client.query(
        `INSERT INTO jit_grants (moderator_id, dispute_id, reason, expires_at)
         VALUES ($1, $2, $3, now() + interval '15 minutes')
         RETURNING id, dispute_id, granted_at, expires_at`,
        [user.id, disputeId, reason]
      );
      return rows[0];
    });
  },

  // Detalle completo: RLS decide. Sin JIT vigente la query devuelve 0 filas,
  // aunque el rol sea moderador (ABAC > RBAC, TP3).
  async findByIdWithPrivateData(user, disputeId) {
    return withUserContext(user, async (client) => {
      const { rows } = await client.query(
        `SELECT d.*, t.buyer_id, t.seller_id, t.amount, t.listing_id
         FROM disputes d JOIN transactions t ON t.id = d.transaction_id
         WHERE d.id = $1`,
        [disputeId]
      );
      return rows[0] || null;
    });
  },

  // Resolucion: refund al comprador o release al vendedor. RLS exige JIT vigente.
  async resolve(user, disputeId, winner, resolution) {
    return withUserContext(user, async (client) => {
      const newStatus = winner === 'buyer' ? 'resolved_buyer' : 'resolved_seller';
      const txStatus = winner === 'buyer' ? 'refunded' : 'released';
      const { rows } = await client.query(
        `UPDATE disputes
         SET status = $1, moderator_id = $2, resolution = $3, resolved_at = now()
         WHERE id = $4 AND status = 'open'
         RETURNING id, transaction_id, status`,
        [newStatus, user.id, resolution, disputeId]
      );
      if (!rows[0]) return null;
      const { rows: trows } = await client.query(
        `UPDATE transactions SET status = $1, updated_at = now() WHERE id = $2
         RETURNING buyer_id, seller_id, listing_id`,
        [txStatus, rows[0].transaction_id]
      );
      const t = trows[0];
      const { rows: lr } = await client.query('SELECT title FROM listings WHERE id = $1', [t.listing_id]);
      const title = lr[0]?.title || 'la transacción';
      const verdict = winner === 'buyer' ? 'a favor del comprador (reembolso)' : 'a favor del vendedor (pago liberado)';
      for (const uid of [t.buyer_id, t.seller_id]) {
        await notificationRepository.notify(client, uid, 'dispute_resolved',
          `Disputa de «${title}» resuelta ${verdict}.`, '/transactions');
      }
      return rows[0];
    });
  },
};
