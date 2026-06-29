// Cliente HTTP con cache en memoria para evitar refetch en cada navegacion (LM-53).
// Cache keyeado por method:path, stale a los 30s (listas) / 60s (detalle).
// Mutaciones invalidan prefixes explicitos para mantener datos frescos.

const USER_KEY = 'lootmarket_user';

// El token de sesion vive en una cookie HttpOnly (inaccesible para JS: no se
// puede robar via XSS). El navegador la envia solo. Aca solo guardamos el user
// para pintar la UI; no es secreto.
export const session = {
  get user() {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  },
  save(user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem(USER_KEY);
    clearAllCache();
  },
};

// ---- Cache layer -----------------------------------------------------------
const cache = new Map();
const DEFAULT_STALE_MS = 30_000;    // 30s para listas
const DETAIL_STALE_MS = 60_000;     // 60s para vistas de detalle

function cacheKey(method, path) {
  return `${method}:${path}`;
}

function getCached(method, path) {
  const entry = cache.get(cacheKey(method, path));
  if (!entry) return null;
  if (Date.now() - entry.timestamp > entry.staleTime) {
    cache.delete(cacheKey(method, path));
    return null;
  }
  return entry.data;
}

function setCache(method, path, data, staleTime) {
  cache.set(cacheKey(method, path), {
    data,
    timestamp: Date.now(),
    staleTime: staleTime || DEFAULT_STALE_MS,
  });
}

export function invalidateCache(prefix) {
  for (const key of cache.keys()) {
    if (key.includes(prefix)) cache.delete(key);
  }
}

export function clearAllCache() {
  cache.clear();
}

// ---- HTTP client -----------------------------------------------------------
export async function api(path, { method = 'GET', body, staleTime } = {}) {
  // GET: servir de cache si esta fresco
  if (method === 'GET') {
    const cached = getCached(method, path);
    if (cached) return cached;
  }

  const headers = { 'Content-Type': 'application/json' };

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    credentials: 'include', // envia la cookie de sesion HttpOnly (V8)
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  // Cachear GETs exitosos
  if (method === 'GET' && res.ok) {
    setCache(method, path, data, staleTime);
  }

  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}
