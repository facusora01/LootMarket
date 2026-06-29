import { withUserContext } from '../db.js';

export const notificationRepository = {
  // Inserta una notificacion usando un client ya dentro de una transaccion
  // (para que sea atomica con el evento que la origina). La policy RLS de INSERT
  // es abierta: el server confiable puede notificar a la contraparte.
  async notify(client, userId, kind, message, link = null) {
    await client.query(
      `INSERT INTO notifications (user_id, kind, message, link)
       VALUES ($1, $2, $3, $4)`,
      [userId, kind, message, link]
    );
  },

  async listMine(user) {
    return withUserContext(user, async (client) => {
      const { rows } = await client.query(
        `SELECT id, kind, message, link, read, created_at
         FROM notifications
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 30`,
        [user.id]
      );
      const unread = rows.filter((r) => !r.read).length;
      return { items: rows, unread };
    });
  },

  async markRead(user, id) {
    return withUserContext(user, async (client) => {
      const { rows } = await client.query(
        `UPDATE notifications SET read = true
         WHERE id = $1 AND user_id = $2
         RETURNING id`,
        [id, user.id]
      );
      return rows[0] || null;
    });
  },

  async markAllRead(user) {
    return withUserContext(user, async (client) => {
      const { rowCount } = await client.query(
        `UPDATE notifications SET read = true
         WHERE user_id = $1 AND NOT read`,
        [user.id]
      );
      return rowCount;
    });
  },
};
