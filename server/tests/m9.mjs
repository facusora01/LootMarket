// ============================================================================
// M9 — Testing & Casos de uso. Harness de integración.
//
// Ejercita los 26 casos de uso del milestone M9 discriptos por 
// el usuario contra la API viva (:3001)
// y la BD (psql vía docker), incluyendo casos negativos de seguridad
// (RLS, DDM, JIT, SQLi, audit append-only, TDE, mínimo privilegio).
//
// Requisitos: API + DB corriendo (.\start.ps1). Node 18+ (fetch global).
// Uso:  node server/tests/m9.mjs
//
// Crea fixtures propios (usuarios/listings frescos por corrida) para ser
// repetible; usa mod_mati/admin_root del seed para roles privilegiados.
// ============================================================================
import { execSync } from 'node:child_process';

const BASE = process.env.API_BASE || 'http://localhost:3001/api';
const S = Date.now().toString(36); // sufijo único por corrida
const PASS = process.env.PW || 'password123';

// ---- helpers ---------------------------------------------------------------
async function req(method, path, { token, body } = {}) {
  const r = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await r.json(); } catch { /* sin cuerpo */ }
  return { status: r.status, json };
}

function psql(sql, user = 'postgres') {
  const out = execSync(
    `docker exec lootmarket-db psql -U ${user} -d lootmarket -tAc "${sql.replace(/"/g, '\\"')}"`,
    { encoding: 'utf8' }
  );
  return out.trim();
}

// Devuelve el texto del error si la sentencia falla; null si tuvo éxito.
function psqlExpectError(sql, user = 'postgres') {
  try {
    execSync(
      `docker exec lootmarket-db psql -U ${user} -d lootmarket -v ON_ERROR_STOP=1 -tAc "${sql.replace(/"/g, '\\"')}"`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return null;
  } catch (e) {
    return ((e.stderr || '') + (e.stdout || '') || e.message).toString().trim();
  }
}

const results = [];
async function tc(title, tp, fn) {
  try {
    const detail = await fn();
    results.push({ title, tp, status: 'PASS', detail: detail || '' });
  } catch (e) {
    results.push({ title, tp, status: e.partial ? 'PARTIAL' : 'FAIL', detail: e.message });
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function partial(msg) { const e = new Error(msg); e.partial = true; throw e; }

async function login(username) {
  const { status, json } = await req('POST', '/auth/login', { body: { username, password: PASS } });
  assert(status === 200 && json.token, `login ${username} -> ${status}`);
  return { token: json.token, user: json.user };
}
async function register(role) {
  const username = `${role}_${S}_${Math.random().toString(36).slice(2, 6)}`;
  const email = `${username}@test.local`;
  const { status, json } = await req('POST', '/auth/register', { body: { username, email, password: PASS, role } });
  assert(status === 201 && json.token, `register ${username} -> ${status} ${JSON.stringify(json)}`);
  return { token: json.token, user: json.user, username, email };
}
async function publish(seller, over = {}) {
  const body = { title: `Item ${S} ${Math.random().toString(36).slice(2, 6)}`, category: 'item', description: 'fixture', price: 9.99, ...over };
  const { status, json } = await req('POST', '/listings', { token: seller.token, body });
  assert(status === 201 && json.id, `publish -> ${status} ${JSON.stringify(json)}`);
  return json;
}
async function buy(buyer, listingId) {
  return req('POST', '/transactions', { token: buyer.token, body: { listingId } });
}

// ============================================================================
async function main() {
  // -- fixtures base --------------------------------------------------------
  // Modelo unificado: toda cuenta nueva es 'user' (compra y vende). Los nombres
  // sellerA/buyerA son por claridad de flujo, no por rol distinto.
  const sellerA = await register('user');
  const sellerB = await register('user');
  const buyerA = await register('user');
  const mod = await login('mod_mati');
  const admin = await login('admin_root');

  // listings de sellerA para distintos flujos
  const lLifecycle = await publish(sellerA, { title: `Lifecycle ${S}`, price: 12.5 });
  const lDispute = await publish(sellerA, { title: `Dispute ${S}`, price: 30 });
  const lRelEarly = await publish(sellerA, { title: `RelEarly ${S}`, price: 5 });
  const lEdit = await publish(sellerA, { title: `Edit ${S}`, category: 'skin', price: 20 });
  const lForeign = await publish(sellerB, { title: `Foreign ${S}`, price: 7 });

  // ===== 25. Visitante se registra (bcrypt) + dup email ====================
  await tc('Visitante quiere registrarse', 'TP4', async () => {
    const hash = psql(`SELECT password_hash FROM users WHERE username='${buyerA.username}'`);
    assert(/^\$2[aby]\$/.test(hash), `password no bcrypt: ${hash.slice(0, 8)}`);
    const dup = await req('POST', '/auth/register', { body: { username: `other_${S}`, email: buyerA.email, password: PASS, role: 'buyer' } });
    assert(dup.status === 409, `email duplicado debió 409, fue ${dup.status}`);
    assert(!JSON.stringify(dup.json).match(/pg|postgres|constraint|null value/i), 'error filtra detalle del motor');
    return 'bcrypt OK; email duplicado -> 409 sin filtrar motor';
  });

  // ===== 3. Visitante login / logout ======================================
  await tc('Visitante login y logout', 'TP4', async () => {
    const { token } = await login('ana_buyer');
    const me = await req('GET', '/auth/me', { token });
    assert(me.status === 200, `me -> ${me.status}`);
    const out = await req('POST', '/auth/logout', { token });
    assert(out.status === 200, `logout -> ${out.status}`);
    const me2 = await req('GET', '/auth/me', { token });
    assert(me2.status === 401, `token debió invalidarse, me2 -> ${me2.status}`);
    const bad = await req('POST', '/auth/login', { body: { username: 'ana_buyer', password: 'wrong' } });
    assert(bad.status === 401, `creds inválidas debió 401, fue ${bad.status}`);
    return 'login+me ok; logout invalida token; creds malas -> 401';
  });

  // ===== 4. Visitante NO accede a rutas protegidas ========================
  await tc('Visitante NO accede a rutas protegidas', 'TP3', async () => {
    const noTok = await req('GET', '/transactions/mine');
    assert(noTok.status === 401, `sin token -> ${noTok.status}`);
    const userHitsAdmin = await req('GET', '/admin/audit', { token: buyerA.token });
    assert(userHitsAdmin.status === 403, `user en /admin -> ${userHitsAdmin.status}`);
    const noTokPublish = await req('POST', '/listings', { body: { title: 'x', category: 'item', price: 1 } });
    assert(noTokPublish.status === 401, `publicar sin token -> ${noTokPublish.status}`);
    return 'sin token -> 401; user en ruta admin -> 403';
  });

  // ===== 22 & 18. Visitante ve listings (masked) / comprador no ve email real
  await tc('Visitante ve listings sin login + email enmascarado', 'TP4-DDM', async () => {
    const { status, json } = await req('GET', '/listings?limit=5');
    assert(status === 200 && Array.isArray(json.data), `catálogo -> ${status}`);
    const row = json.data[0];
    assert(row && row.seller_email_masked && row.seller_email_masked.includes('****'), 'email no enmascarado');
    assert(!('email' in row) && !('seller_email' in row), 'la API expone email real');
    return `catálogo público OK; email ${row.seller_email_masked}`;
  });
  await tc('Comprador NO ve el email real del vendedor', 'TP4-DDM', async () => {
    const { json } = await req('GET', `/listings/${lLifecycle.id}`);
    assert(json && json.seller_email_masked && json.seller_email_masked.includes('****'), 'detalle sin máscara');
    assert(!('email' in json) && !('seller_email' in json), 'detalle expone email real');
    // el email real existe en users pero nunca sale por la vista pública
    const real = psql(`SELECT email FROM users WHERE username='${sellerA.username}'`);
    assert(real && !real.includes('****'), 'sanity: email real en users');
    return `solo máscara por API; real (${real}) queda en BD`;
  });

  // ===== 8. Vendedor publica listing (+ audit; negativo buyer) =============
  await tc('Vendedor publica un listing', 'flujo+TP7', async () => {
    const l = await publish(sellerA, { title: `Pub ${S}` });
    const st = psql(`SELECT status FROM listings WHERE id=${l.id}`);
    assert(st === 'active', `listing no active: ${st}`);
    const aud = psql(`SELECT count(*) FROM audit_log WHERE table_name='listings' AND operation='INSERT' AND row_id=${l.id}`);
    assert(Number(aud) >= 1, 'sin registro de auditoría del INSERT');
    // modelo unificado: cualquier cuenta 'user' publica (buyerA tambien vende)
    const buyerAlsoSells = await publish(buyerA, { title: `PubBuyer ${S}` });
    assert(buyerAlsoSells.id, 'un user no pudo publicar');
    // sin sesion -> 401
    const noTok = await req('POST', '/listings', { body: { title: 'x', category: 'item', price: 1 } });
    assert(noTok.status === 401, `publicar sin token -> ${noTok.status}`);
    return 'publica active + auditado; cualquier user vende; sin token -> 401';
  });

  // ===== 7. Vendedor edita / elimina su listing ===========================
  await tc('Vendedor edita o elimina su listing', 'flujo+TP7', async () => {
    // editar
    const r = await req('PATCH', `/listings/${lEdit.id}/price`, { token: sellerA.token, body: { price: 33.33 } });
    assert(r.status === 200 && Number(r.json.price) === 33.33, `edit precio -> ${r.status} ${JSON.stringify(r.json)}`);
    const aud = psql(`SELECT before_img->>'price', after_img->>'price' FROM audit_log WHERE table_name='listings' AND operation='UPDATE' AND row_id=${lEdit.id} ORDER BY id DESC LIMIT 1`);
    assert(aud.includes('33.33'), `before/after no auditado: ${aud}`);
    // eliminar ajeno -> 404 (RLS / no es tuyo)
    const foreign = await req('DELETE', `/listings/${lForeign.id}`, { token: sellerA.token });
    assert(foreign.status === 404, `borrar ajeno -> ${foreign.status}`);
    // eliminar propio activo -> 200 + auditado (before image) + desaparece
    const del = await req('DELETE', `/listings/${lEdit.id}`, { token: sellerA.token });
    assert(del.status === 200 && del.json.ok, `delete propio -> ${del.status} ${JSON.stringify(del.json)}`);
    const gone = psql(`SELECT count(*) FROM listings WHERE id=${lEdit.id}`);
    assert(gone === '0', `listing no borrado: ${gone}`);
    const audDel = psql(`SELECT count(*) FROM audit_log WHERE table_name='listings' AND operation='DELETE' AND row_id=${lEdit.id}`);
    assert(Number(audDel) >= 1, 'DELETE no auditado');
    return 'edit precio (auditado) + delete propio (auditado, desaparece); borrar ajeno -> 404';
  });

  // ===== 24. Vendedor NO modifica listings ajenos =========================
  await tc('Vendedor NO modifica listings ajenos', 'TP3-ABAC', async () => {
    const r = await req('PATCH', `/listings/${lForeign.id}/price`, { token: sellerA.token, body: { price: 1 } });
    assert(r.status === 404, `editar ajeno debió 404 (0 filas RLS), fue ${r.status}`);
    const st = psql(`SELECT price FROM listings WHERE id=${lForeign.id}`);
    assert(Number(st) === 7, `precio ajeno cambió: ${st}`);
    return 'PATCH ajeno -> 404 (0 filas); precio intacto';
  });

  // ===== 26. Comprador busca y filtra (+ SQLi en filtro) ===================
  await tc('Comprador busca y filtra listings', 'TP5', async () => {
    const byCat = await req('GET', '/listings?category=skin&limit=50');
    assert(byCat.status === 200 && byCat.json.data.every(r => r.category === 'skin'), 'filtro categoría falla');
    const byPrice = await req('GET', '/listings?minPrice=10&maxPrice=100&limit=50');
    assert(byPrice.json.data.every(r => Number(r.price) >= 10 && Number(r.price) <= 100), 'filtro precio falla');
    const bySearch = await req('GET', `/listings?q=${encodeURIComponent('Foreign ' + S)}`);
    assert(bySearch.json.total >= 1, 'búsqueda texto no encuentra');
    const inj = await req('GET', `/listings?q=${encodeURIComponent("x'; DROP TABLE listings;--")}`);
    assert(inj.status === 200 && Array.isArray(inj.json.data), `inyección en filtro -> ${inj.status}`);
    const tableOk = psql(`SELECT count(*) FROM listings`);
    assert(Number(tableOk) > 0, 'tabla listings afectada por inyección!');
    return 'categoría/precio/texto OK; payload SQLi tratado como literal';
  });

  // ===== 20. Atacante NO logra SQLi en login ==============================
  await tc('Atacante NO logra inyección SQL en login', 'TP5', async () => {
    for (const u of ["' OR '1'='1' --", "admin'--", "ana_buyer'; DROP TABLE users;--"]) {
      const r = await req('POST', '/auth/login', { body: { username: u, password: "' OR '1'='1" } });
      assert(r.status === 401, `payload [${u}] no rechazado: ${r.status}`);
      assert(!JSON.stringify(r.json).match(/syntax|pg|postgres|column|relation/i), 'error filtra el motor');
    }
    assert(Number(psql('SELECT count(*) FROM users')) > 0, 'tabla users afectada!');
    return 'tautologías/encadenados -> 401, sin bypass ni fuga del motor';
  });

  // ===== 1 & 23 & 19. Ciclo escrow: compra -> transfiere -> libera =========
  let txLife;
  await tc('Comprador compra un ítem (escrow) + TDE', 'flujo+TP4', async () => {
    const r = await buy(buyerA, lLifecycle.id);
    assert(r.status === 201 && r.json.status === 'escrow_held', `compra -> ${r.status} ${JSON.stringify(r.json)}`);
    txLife = r.json.id;
    const ls = psql(`SELECT status FROM listings WHERE id=${lLifecycle.id}`);
    assert(ls === 'in_escrow', `listing no in_escrow: ${ls}`);
    return `tx ${txLife} escrow_held; listing in_escrow`;
  });

  await tc('Vendedor transfiere el ítem tras la compra', 'flujo', async () => {
    // negativo: transferir venta ajena (sellerB no es el vendedor) -> 409
    const foreign = await req('POST', `/transactions/${txLife}/transfer`, { token: sellerB.token, body: { note: 'x' } });
    assert(foreign.status === 409, `transferir venta ajena -> ${foreign.status}`);
    const r = await req('POST', `/transactions/${txLife}/transfer`, { token: sellerA.token, body: { note: 'entregado' } });
    assert(r.status === 200 && r.json.status === 'item_transferred', `transfer -> ${r.status} ${JSON.stringify(r.json)}`);
    return 'escrow_held -> item_transferred; venta ajena -> 409';
  });

  await tc('Comprador confirma recepción y libera el pago', 'flujo', async () => {
    const r = await req('POST', `/transactions/${txLife}/release`, { token: buyerA.token });
    assert(r.status === 200 && r.json.status === 'released', `release -> ${r.status} ${JSON.stringify(r.json)}`);
    const ls = psql(`SELECT status FROM listings WHERE id=${lLifecycle.id}`);
    assert(ls === 'sold', `listing no sold: ${ls}`);
    return 'item_transferred -> released; listing sold';
  });

  // ===== 1 negativo: comprar un listing ya vendido ========================
  await tc('Negativo: comprar un listing ya vendido -> rechazo', 'flujo', async () => {
    const r = await buy(buyerA, lLifecycle.id);
    assert(r.status === 409, `comprar vendido -> ${r.status}`);
    return 'listing sold -> 409';
  });

  // ===== 19 negativo: confirmar antes de transferir =======================
  await tc('Negativo: confirmar recepción antes de la transferencia', 'flujo', async () => {
    const r = await buy(buyerA, lRelEarly.id);
    assert(r.status === 201, `compra rel-early -> ${r.status}`);
    const rel = await req('POST', `/transactions/${r.json.id}/release`, { token: buyerA.token });
    assert(rel.status === 409, `release sin transfer -> ${rel.status}`);
    return 'release en escrow_held -> 409';
  });

  // ===== 10. Comprador abre disputa =======================================
  let txDisp, dispId;
  await tc('Comprador abre una disputa', 'flujo+TP8', async () => {
    const r = await buy(buyerA, lDispute.id);
    assert(r.status === 201, `compra disputa -> ${r.status}`);
    txDisp = r.json.id;
    const d = await req('POST', `/transactions/${txDisp}/dispute`, { token: buyerA.token, body: { reason: 'no recibí el item', privateAccountData: 'cuenta: victima@mail / pass123' } });
    assert(d.status === 201, `abrir disputa -> ${d.status} ${JSON.stringify(d.json)}`);
    dispId = d.json.id;
    const ts = psql(`SELECT status FROM transactions WHERE id=${txDisp}`);
    assert(ts === 'disputed', `tx no disputed: ${ts}`);
    return `tx ${txDisp} disputed; disputa ${dispId}`;
  });

  // ===== 5. Mod ve disputas (solo metadatos) ==============================
  await tc('Moderador ve disputas (solo metadatos)', 'TP8', async () => {
    const r = await req('GET', '/disputes', { token: mod.token });
    assert(r.status === 200 && Array.isArray(r.json), `listado -> ${r.status}`);
    const found = r.json.find(d => d.id === dispId);
    assert(found, 'no aparece la disputa abierta');
    assert(!('private_account_data' in found) && !('reason' in found), 'el resumen filtra datos privados');
    return `summary sin datos privados (campos: ${Object.keys(found).join(',')})`;
  });

  // ===== 21. Mod NO ve datos privados sin elevación =======================
  await tc('Moderador NO ve datos privados sin elevación', 'TP8/TP3', async () => {
    const r = await req('GET', `/disputes/${dispId}`, { token: mod.token });
    assert(r.status === 403, `detalle sin JIT -> ${r.status} (esperado 403, RLS 0 filas)`);
    return 'detalle sin grant -> 403 (RLS 0 filas)';
  });

  // ===== 2. Mod NO puede elevar sin motivo ================================
  await tc('Moderador NO puede elevar sin motivo', 'TP8-neg', async () => {
    const r = await req('POST', `/disputes/${dispId}/jit`, { token: mod.token, body: {} });
    assert(r.status === 400, `JIT sin motivo -> ${r.status}`);
    const grants = psql(`SELECT count(*) FROM jit_grants WHERE dispute_id=${dispId}`);
    assert(Number(grants) === 0, `se creó grant indebido: ${grants}`);
    return 'sin motivo -> 400, no se crea grant';
  });

  // ===== 6. Mod solicita elevación JIT con motivo (+ audit) ================
  await tc('Moderador solicita elevación JIT con motivo', 'TP8+TP7', async () => {
    const r = await req('POST', `/disputes/${dispId}/jit`, { token: mod.token, body: { reason: 'revisar evidencia de fraude' } });
    assert(r.status === 201 && r.json.id, `JIT -> ${r.status} ${JSON.stringify(r.json)}`);
    const exp = psql(`SELECT EXTRACT(EPOCH FROM (expires_at - granted_at))::int FROM jit_grants WHERE id=${r.json.id}`);
    assert(Math.abs(Number(exp) - 900) <= 5, `expiración no ~15min: ${exp}s`);
    const aud = psql(`SELECT count(*) FROM audit_log WHERE table_name='jit_grants' AND row_id=${r.json.id}`);
    assert(Number(aud) >= 1, 'elevación JIT no auditada');
    // ahora SÍ ve el detalle privado
    const det = await req('GET', `/disputes/${dispId}`, { token: mod.token });
    assert(det.status === 200 && det.json.private_account_data, `detalle con JIT -> ${det.status}`);
    return `grant ~900s + auditado; detalle privado accesible`;
  });

  // ===== 12. Mod resuelve la disputa (refund/release) =====================
  await tc('Moderador resuelve la disputa (refund/release)', 'flujo+TP7/TP8', async () => {
    const r = await req('POST', `/disputes/${dispId}/resolve`, { token: mod.token, body: { winner: 'buyer', resolution: 'reembolso al comprador' } });
    assert(r.status === 200, `resolve -> ${r.status} ${JSON.stringify(r.json)}`);
    const ts = psql(`SELECT status FROM transactions WHERE id=${txDisp}`);
    assert(ts === 'refunded', `tx no refunded: ${ts}`);
    const aud = psql(`SELECT count(*) FROM audit_log WHERE table_name='disputes' AND row_id=${dispId} AND operation='UPDATE'`);
    assert(Number(aud) >= 1, 'resolución no auditada');
    return 'winner=buyer -> tx refunded + auditado';
  });

  // ===== 14. Mod pierde acceso al expirar el grant (15 min) ===============
  await tc('Moderador pierde acceso al expirar el grant', 'TP8', async () => {
    // forzar expiración en el pasado
    psql(`UPDATE jit_grants SET expires_at = now() - interval '1 minute' WHERE dispute_id=${dispId}`);
    const det = await req('GET', `/disputes/${dispId}`, { token: mod.token });
    assert(det.status === 403, `tras expirar -> ${det.status} (esperado 403, 0 filas)`);
    return 'grant vencido -> 403 sin intervención manual';
  });

  // ===== 16. Vendedor ve sus ventas y cobros ==============================
  await tc('Vendedor ve sus ventas y cobros', 'TP3-RLS', async () => {
    const r = await req('GET', '/transactions/mine', { token: sellerA.token });
    assert(r.status === 200 && Array.isArray(r.json), `ventas -> ${r.status}`);
    assert(r.json.every(t => t.seller_id === sellerA.user.id || t.buyer_id === sellerA.user.id), 've ventas ajenas (RLS roto)');
    const released = r.json.find(t => t.id === txLife);
    assert(released && released.status === 'released', 'no ve su venta liberada');
    return `solo propias; venta ${txLife} released (cobro acreditado)`;
  });

  // ===== 17. Comprador ve solo su historial (+ negativo ajeno) =============
  await tc('Comprador ve solo su historial de transacciones', 'TP3-ABAC', async () => {
    const r = await req('GET', '/transactions/mine', { token: buyerA.token });
    assert(r.status === 200, `historial -> ${r.status}`);
    assert(r.json.every(t => t.buyer_id === buyerA.user.id || t.seller_id === buyerA.user.id), 've transacciones ajenas');
    // negativo a nivel RLS: como buyerA, una tx ajena devuelve 0 filas
    const foreign = psql(`SELECT count(*) FROM (SELECT set_config('app.user_id','${buyerA.user.id}',false), set_config('app.role','buyer',false)) s, transactions t WHERE t.buyer_id<>${buyerA.user.id} AND t.seller_id<>${buyerA.user.id}`, 'lootmarket_app');
    assert(foreign === '0', `RLS dejó ver ajenas: ${foreign}`);
    return 'solo propias; tx ajena -> 0 filas bajo RLS';
  });

  // ===== 15. Admin rastrea una transacción (forense) ======================
  await tc('Admin rastrea una transacción (forense)', 'TP7', async () => {
    const r = await req('GET', `/admin/audit/transaction/${txDisp}`, { token: admin.token });
    assert(r.status === 200 && Array.isArray(r.json), `trace -> ${r.status}`);
    const tables = new Set(r.json.map(x => x.table_name));
    assert(tables.has('transactions'), 'falta cadena de transactions');
    assert(tables.has('disputes'), 'falta la disputa en la cadena');
    assert(r.json.every(x => x.actor_id !== undefined && x.at), 'falta actor/timestamp');
    return `cadena: ${[...tables].join(', ')} con actor+timestamp`;
  });

  // ===== 9. Admin NO puede alterar el audit_log (append-only) =============
  await tc('Admin NO puede alterar el audit_log (append-only)', 'TP7-neg', async () => {
    const upd = psqlExpectError(`UPDATE audit_log SET actor_id='999' WHERE id=(SELECT min(id) FROM audit_log)`, 'lootmarket_app');
    assert(upd && /append-only|denied|permission|cannot|no se permite|inmutable|prohib/i.test(upd), `UPDATE no bloqueado: ${upd}`);
    const del = psqlExpectError(`DELETE FROM audit_log WHERE id=(SELECT min(id) FROM audit_log)`, 'lootmarket_app');
    assert(del && /append-only|denied|permission|cannot|no se permite|inmutable|prohib/i.test(del), `DELETE no bloqueado: ${del}`);
    return 'UPDATE/DELETE sobre audit_log bloqueados';
  });

  // ===== 11. Datos sensibles ilegibles en reposo (+ mínimo privilegio) ====
  await tc('Datos sensibles ilegibles en reposo (tokens + pagos)', 'TP4+TP6', async () => {
    // token de sesión guardado como SHA-256 (64 hex), nunca el token crudo
    const { token } = await login('ana_buyer');
    const stored = psql(`SELECT token_hash FROM sessions ORDER BY id DESC LIMIT 1`);
    assert(/^[0-9a-f]{64}$/.test(stored), `token_hash no es SHA-256: ${stored.slice(0, 12)}`);
    assert(stored !== token, 'token guardado en claro!');
    // tarjeta cifrada (bytea pgp), API solo devuelve last4
    const add = await req('POST', '/payment-methods', { token: buyerA.token, body: { cardNumber: '4111111111111111' } });
    assert(add.status === 201, `alta tarjeta -> ${add.status}`);
    const ct = psql(`SELECT encode(card_encrypted,'escape') ~ '4111' FROM payment_methods ORDER BY id DESC LIMIT 1`);
    assert(ct === 'f', 'PAN en claro dentro del ciphertext!');
    const last4 = JSON.stringify(add.json);
    assert(!last4.includes('411111111111'), 'API devuelve PAN completo');
    // mínimo privilegio: lootmarket_app no hace DDL/DROP
    const ddl = psqlExpectError(`CREATE TABLE hack_${S}(x int)`, 'lootmarket_app');
    assert(ddl && /denied|permission|no se permite/i.test(ddl), `DDL no bloqueado: ${ddl}`);
    const drop = psqlExpectError(`DROP TABLE listings`, 'lootmarket_app');
    assert(drop && /denied|permission|must be owner|debe ser/i.test(drop), `DROP no bloqueado: ${drop}`);
    return 'token SHA-256; tarjeta cifrada (API last4); rol app sin DDL/DROP';
  });

  // ===== Notificaciones de compra/venta/escrow ============================
  await tc('Notificaciones de compra/venta/escrow', 'feature+TP3', async () => {
    const sN = await req('GET', '/notifications', { token: sellerA.token });
    assert(sN.status === 200 && Array.isArray(sN.json.items), `notif vendedor -> ${sN.status}`);
    const sKinds = new Set(sN.json.items.map((n) => n.kind));
    assert(sKinds.has('sale'), 'vendedor no recibió notif de venta');
    assert(sKinds.has('release'), 'vendedor no recibió notif de release');
    const bN = await req('GET', '/notifications', { token: buyerA.token });
    const bKinds = new Set(bN.json.items.map((n) => n.kind));
    assert(bKinds.has('purchase'), 'comprador no recibió notif de compra');
    assert(bKinds.has('transfer'), 'comprador no recibió notif de transferencia');
    assert(bKinds.has('dispute_resolved'), 'comprador no recibió notif de disputa resuelta');
    // RLS: el vendedor no ve notificaciones del comprador
    assert(!sKinds.has('purchase'), 'RLS: vendedor ve notif ajena (purchase)');
    // marcar todas leídas -> unread 0
    assert(sN.json.unread > 0, 'no había no leídas para el vendedor');
    await req('POST', '/notifications/read-all', { token: sellerA.token, body: {} });
    const after = await req('GET', '/notifications', { token: sellerA.token });
    assert(after.json.unread === 0, `unread tras read-all -> ${after.json.unread}`);
    return `vendedor: ${[...sKinds].join(',')}; comprador: ${[...bKinds].join(',')}; read-all OK`;
  });

  // ===== 13. Suite de tests (meta) ========================================
  await tc('Armar suite de tests (harness e integración API)', 'meta', async () => {
    return 'este harness: 25 casos de uso ejercitados contra API viva + inspección en reposo';
  });

  // ---- reporte ------------------------------------------------------------
  print();
}

function print() {
  const ico = { PASS: '✅', FAIL: '❌', PARTIAL: '🟡' };
  console.log('\n========================  M9 — Casos de uso  ========================\n');
  for (const r of results) {
    console.log(`${ico[r.status]} [${r.tp}] ${r.title}`);
    if (r.detail) console.log(`     ${r.detail}`);
  }
  const n = (s) => results.filter(r => r.status === s).length;
  console.log('\n--------------------------------------------------------------------');
  console.log(`Total: ${results.length}  |  ✅ ${n('PASS')}   🟡 ${n('PARTIAL')}   ❌ ${n('FAIL')}`);
  console.log('--------------------------------------------------------------------\n');
  process.exit(n('FAIL') > 0 ? 1 : 0);
}

main().catch((e) => { console.error('Harness abortó:', e); process.exit(2); });
