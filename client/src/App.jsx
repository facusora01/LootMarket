import { useState } from 'react';
import { Routes, Route, Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { api, session } from './api.js';
import { Icon } from './components/Icon.jsx';
import { Avatar } from './components/Avatar.jsx';
import { Button } from './components/Button.jsx';
import Listings from './pages/Listings.jsx';
import Login from './pages/Login.jsx';
import Sell from './pages/Sell.jsx';
import MyTransactions from './pages/MyTransactions.jsx';
import Disputes from './pages/Disputes.jsx';
import Audit from './pages/Audit.jsx';
import Payments from './pages/Payments.jsx';

function AppHeader({ user, onLogout }) {
  const location = useLocation();
  const path = location.pathname;

  const nav = [
    { to: '/', label: 'Mercado', show: true },
    { to: '/transactions', label: 'Mis trades', show: !!user },
    { to: '/payments', label: 'Pagos', show: !!user },
    { to: '/sell', label: 'Vender', show: user?.role === 'seller' },
    { to: '/disputes', label: 'Disputas', show: user?.role === 'moderator' || user?.role === 'admin' },
    { to: '/audit', label: 'Auditoría', show: user?.role === 'admin' },
  ].filter(n => n.show);

  return (
    <header className="lmk-header">
      <div className="lmk-header__inner">
        <Link to="/" className="lmk-brand">
          Loot<span>Market</span>
        </Link>

        <div className="lmk-search">
          <Icon name="search" size={16} />
          <input placeholder="Buscá skins, cuentas, keys…" />
          <kbd>/</kbd>
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
              <Button variant="ghost" size="sm" onClick={onLogout}>Salir</Button>
              <Avatar name={user.username} size="md" status="online" />
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
      <AppHeader user={user} onLogout={logout} />
      <main className="lmk-main">
        <Routes>
          <Route path="/" element={<Listings user={user} />} />
          <Route path="/login" element={<Login onAuth={setUser} />} />
          <Route path="/sell" element={user ? <Sell /> : <Navigate to="/login" />} />
          <Route path="/transactions" element={user ? <MyTransactions /> : <Navigate to="/login" />} />
          <Route path="/payments" element={user ? <Payments /> : <Navigate to="/login" />} />
          <Route path="/disputes" element={user ? <Disputes user={user} /> : <Navigate to="/login" />} />
          <Route path="/audit" element={user?.role === 'admin' ? <Audit /> : <Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}
