import { withUserContext, PAYMENT_KEY } from '../db.js';

export const paymentRepository = {
  // TP4: numero de tarjeta cifrado en reposo con pgp_sym_encrypt (pgcrypto).
  // En disco solo hay bytea cifrado + last4 para mostrar en UI.
  async add(user, cardNumber) {
    const last4 = cardNumber.slice(-4);
    return withUserContext(user, async (client) => {
      const { rows } = await client.query(
        `INSERT INTO payment_methods (user_id, card_encrypted, card_last4)
         VALUES ($1, pgp_sym_encrypt($2, $3), $4)
         RETURNING id, card_last4, created_at`,
        [user.id, cardNumber, PAYMENT_KEY, last4]
      );
      return rows[0];
    });
  },

  // RLS garantiza que solo el dueño ve sus tarjetas; ademas solo se expone last4
  async listMine(user) {
    return withUserContext(user, async (client) => {
      const { rows } = await client.query(
        `SELECT id, card_last4, created_at FROM payment_methods ORDER BY id`
      );
      return rows;
    });
  },
};
