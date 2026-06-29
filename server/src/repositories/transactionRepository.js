import { withUserContext } from '../db.js';
import { notificationRepository } from './notificationRepository.js';

const money = (n) => `$${Number(n).toFixed(2)}`;

export const transactionRepository = {
  // Compra = escrow: el monto queda retenido, el listing pasa a in_escrow.
  // Todo en UNA transaccion SQL (atomicidad) y auditado por triggers (TP7).
  async createEscrow(user, listingId) {
    return withUserContext(user, async (client) => {
      // 1) Validar y lockear el listing (sigue 'active', no es propio). FOR UPDATE
      //    serializa compras concurrentes del mismo item.
      const { rows: lrows } = await client.query(
        `SELECT id, seller_id, price, title FROM listings
         WHERE id = $1 AND status = 'active' AND seller_id <> $2
         FOR UPDATE`,
        [listingId, user.id]
      );
      if (!lrows[0]) return null;
      const l = lrows[0];
      // 2) Crear la transaccion ANTES de mover el listing a escrow: la policy
      //    RLS de listings (SELECT, usada tambien como WITH CHECK en el UPDATE)
      //    deja al comprador ver un listing no-'active' solo si EXISTS una
      //    transaccion suya sobre el. Sin esta fila previa, el UPDATE a
      //    'in_escrow' produce una fila invisible al comprador -> error 42501.
      const { rows } = await client.query(
        `INSERT INTO transactions (listing_id, buyer_id, seller_id, amount)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [l.id, user.id, l.seller_id, l.price]
      );
      // 3) Mover el listing a escrow; la fila sigue visible via EXISTS(transactions).
      await client.query(
        `UPDATE listings SET status = 'in_escrow', updated_at = now() WHERE id = $1`,
        [l.id]
      );
      // 4) Notificar: venta al vendedor, compra al comprador (atomico con el escrow).
      await notificationRepository.notify(client, l.seller_id, 'sale',
        `Te compraron «${l.title}» por ${money(l.price)}. Transferí el item.`, '/transactions');
      await notificationRepository.notify(client, user.id, 'purchase',
        `Compra iniciada: «${l.title}». Fondos en escrow.`, '/transactions');
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
      const tx = rows[0];
      const { rows: lr } = await client.query('SELECT title FROM listings WHERE id = $1', [tx.listing_id]);
      const title = lr[0]?.title || 'tu item';
      await notificationRepository.notify(client, tx.buyer_id, 'transfer',
        `El vendedor transfirió «${title}». Confirmá la recepción para liberar el pago.`, '/transactions');
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
      const tx = rows[0];
      await client.query(
        `UPDATE listings SET status = 'sold', updated_at = now() WHERE id = $1`,
        [tx.listing_id]
      );
      const { rows: lr } = await client.query('SELECT title FROM listings WHERE id = $1', [tx.listing_id]);
      const title = lr[0]?.title || 'tu venta';
      await notificationRepository.notify(client, tx.seller_id, 'release',
        `«${title}» liberado: cobraste ${money(tx.amount)}.`, '/transactions');
      return rows[0];
    });
  },

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
