import { pool, withUserContext } from '../db.js';

export const listingRepository = {
  // TP4: catalogo publico siempre via vista con DDM — email del vendedor enmascarado
  // Modificado para soportar paginación, filtros de categoría, ordenamiento y búsqueda (q) desde DB
  async findAllPublicPaginated({ limit, offset, category, sort, q, minPrice, maxPrice }) {
    let whereClauses = ["status = 'active'"];
    let params = [];
    let paramIndex = 1;

    // Filtro por Categoría
    if (category !== 'all') {
      whereClauses.push(`category = $${paramIndex}`);
      params.push(category);
      paramIndex++;
    }

    // Filtro por Búsqueda de Texto (q)
    if (q) {
      whereClauses.push(`(LOWER(title) LIKE $${paramIndex} OR LOWER(description) LIKE $${paramIndex} OR LOWER(seller_username) LIKE $${paramIndex})`);
      params.push(`%${q.toLowerCase()}%`);
      paramIndex++;
    }

    // Filtro por Precio Mínimo
    if (minPrice !== undefined && minPrice !== null && minPrice !== '') {
      whereClauses.push(`price >= $${paramIndex}`);
      params.push(Number(minPrice));
      paramIndex++;
    }

    // Filtro por Precio Máximo
    if (maxPrice !== undefined && maxPrice !== null && maxPrice !== '') {
      whereClauses.push(`price <= $${paramIndex}`);
      params.push(Number(maxPrice));
      paramIndex++;
    }

    const whereSQL = `WHERE ${whereClauses.join(' AND ')}`;

    // Ordenamiento (Sort)
    let orderBySQL = 'ORDER BY created_at DESC'; 
    if (sort === 'price-asc') orderBySQL = 'ORDER BY price ASC';
    else if (sort === 'price-desc') orderBySQL = 'ORDER BY price DESC';

    // Consulta para obtener el TOTAL de registros
    const countQuery = `SELECT COUNT(*)::int FROM v_listings_public ${whereSQL}`;
    const countRes = await pool.query(countQuery, params);
    const total = countRes.rows[0].count;

    // Consulta para obtener la data PAGINADA
    const selectParams = [...params, limit, offset];
    const selectQuery = `
      SELECT * FROM v_listings_public 
      ${whereSQL} 
      ${orderBySQL} 
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    const { rows } = await pool.query(selectQuery, selectParams);

    return {
      data: rows,
      total: total
    };
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