import { useEffect, useRef, useState } from 'react';
import { Routes, Route, Link, useNavigate, useLocation, useSearchParams, Navigate } from 'react-router-dom';
import { api, session } from './api.js';
import { Icon } from './components/Icon.jsx';
import { Avatar } from './components/Avatar.jsx';
import { NotificationBell } from './components/NotificationBell.jsx';
import { Button } from './components/Button.jsx';
import DotGrid from './components/DotGrid.jsx';
import Listings from './pages/Listings.jsx';
import ListingDetail from './pages/ListingDetail.jsx';
import Login from './pages/Login.jsx';
import Sell from './pages/Sell.jsx';
import MyTransactions from './pages/MyTransactions.jsx';
import Disputes from './pages/Disputes.jsx';
import Audit from './pages/Audit.jsx';
import Payments from './pages/Payments.jsx';
import Profile from './pages/Profile.jsx';

function AppHeader({ user, onLogout }) {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const [catalog, setCatalog] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const searchRef = useRef(null);
  const boxRef = useRef(null);

  // Catálogo para el autocomplete: se carga una vez y se refresca al loguear.
  useEffect(() => {
    api('/listings?limit=1000').then((r) => setCatalog(r.data || [])).catch(() => setCatalog([]));
  }, [user]);

  // Mantener el input sincronizado cuando la URL cambia (back/forward, navegación interna).
  useEffect(() => { setQ(params.get('q') || ''); }, [params]);

  // Atajo "/" para enfocar la búsqueda (lo que sugería el <kbd>).
  useEffect(() => {
    function onKey(e) {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Cerrar el dropdown al clickear afuera.
  useEffect(() => {
    function onClick(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, []);

  const term = q.trim().toLowerCase();
  const suggestions = term
    ? catalog
        .filter((l) =>
          (l.title || '').toLowerCase().includes(term) ||
          (l.description || '').toLowerCase().includes(term) ||
          (l.category || '').toLowerCase().includes(term) ||
          (l.seller_username || '').toLowerCase().includes(term))
        .slice(0, 6)
    : [];

  function runSearch(value) {
    setOpen(false);
    navigate(value.trim() ? `/?q=${encodeURIComponent(value.trim())}` : '/');
  }

  function goToListing(id) {
    setOpen(false);
    searchRef.current?.blur();
    navigate(`/listing/${id}`);
  }

  function submitSearch(e) {
    e.preventDefault();
    if (open && active >= 0 && suggestions[active]) goToListing(suggestions[active].id);
    else runSearch(q);
  }

  function onSearchKey(e) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { setOpen(true); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, -1)); }
    else if (e.key === 'Escape') { setOpen(false); setActive(-1); }
  }

  const nav = [
    { to: '/', label: 'Mercado', show: true },
    { to: '/sell', label: 'Vender', show: !!user },
    { to: '/transactions', label: 'Mis trades', show: !!user },
    { to: '/disputes', label: 'Disputas', show: user?.role === 'moderator' || user?.role === 'admin' },
    { to: '/audit', label: 'Auditoría', show: user?.role === 'admin' },
  ].filter(n => n.show);

  return (
    <header className="lmk-header">
      <div className="lmk-header__inner">
        <div className="lmk-histnav">
          <button className="lmk-iconbtn" onClick={() => navigate(-1)} title="Atrás" aria-label="Atrás">
            <Icon name="arrow-left" size={16} />
          </button>
          <button className="lmk-iconbtn" onClick={() => navigate(1)} title="Adelante" aria-label="Adelante">
            <Icon name="arrow-right" size={16} />
          </button>
        </div>

        <Link to="/" className="lmk-brand">
          Loot<span>Market</span>
        </Link>

        <div className="lmk-searchwrap" ref={boxRef}>
          <form className="lmk-search" onSubmit={submitSearch}>
            <Icon name="search" size={16} />
            <input
              ref={searchRef}
              placeholder="Buscá skins, cuentas, keys…"
              value={q}
              onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(-1); }}
              onFocus={() => setOpen(true)}
              onKeyDown={onSearchKey}
              autoComplete="off"
            />
            <kbd>/</kbd>
          </form>
          {open && term && (
            <div className="lmk-suggest">
              {suggestions.length > 0 ? (
                <>
                  {suggestions.map((l, i) => (
                    <button
                      type="button"
                      key={l.id}
                      className={'lmk-suggest__item' + (i === active ? ' is-active' : '')}
                      onMouseEnter={() => setActive(i)}
                      onMouseDown={(e) => { e.preventDefault(); goToListing(l.id); }}
                    >
                      <Icon name="search" size={14} />
                      <span className="lmk-suggest__title">{l.title}</span>
                      <span className="lmk-suggest__cat">{l.category}</span>
                      <span className="lmk-suggest__price">${l.price}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    className="lmk-suggest__all"
                    onMouseDown={(e) => { e.preventDefault(); runSearch(q); }}
                  >
                    Ver todos los resultados para “{q.trim()}”
                  </button>
                </>
              ) : (
                <div className="lmk-suggest__empty">Sin coincidencias para “{q.trim()}”</div>
              )}
            </div>
          )}
        </div>

        <nav className="lmk-nav">
          {nav.map(n => (
            <Link
              key={n.to}
              to={n.to}
              className={'lmk-nav__item' + (path === n.to ? ' is-active' : '')}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="lmk-header__right">
          {user ? (
            <>
              <span className="lm-badge lm-badge--primary" style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>
                {user.username} · {user.role}
              </span>
              <NotificationBell />
              <Button variant="ghost" size="sm" onClick={onLogout}>Salir</Button>
              <Link to="/profile" title="Mi perfil" aria-label="Mi perfil">
                <Avatar name={user.username} size="md" status="online" />
              </Link>
            </>
          ) : (
            <Link to="/login" className="lm-btn lm-btn--primary lm-btn--sm">Ingresar</Link>
          )}
        </div>
      </div>
    </header>
  );
}

export default function App() {
  const [user, setUser] = useState(session.user);
  const navigate = useNavigate();

  async function logout() {
    try { await api('/auth/logout', { method: 'POST' }); } catch { /* sesión ya inválida */ }
    session.clear();
    setUser(null);
    navigate('/');
  }

  return (
    <div className="lmk-app">
      <DotGrid />
      <AppHeader user={user} onLogout={logout} />
      <main className="lmk-main">
        <Routes>
          <Route path="/" element={<Listings user={user} />} />
          <Route path="/listing/:id" element={<ListingDetail user={user} />} />
          <Route path="/login" element={<Login onAuth={setUser} />} />
          <Route path="/sell" element={user ? <Sell /> : <Navigate to="/login" />} />
          <Route path="/transactions" element={user ? <MyTransactions /> : <Navigate to="/login" />} />
          <Route path="/payments" element={user ? <Payments /> : <Navigate to="/login" />} />
          <Route path="/profile" element={user ? <Profile user={user} /> : <Navigate to="/login" />} />
          <Route path="/disputes" element={user ? <Disputes user={user} /> : <Navigate to="/login" />} />
          <Route path="/audit" element={user?.role === 'admin' ? <Audit /> : <Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}
