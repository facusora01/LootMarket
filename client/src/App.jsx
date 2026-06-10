import { useState } from 'react';
import { Routes, Route, Link, useNavigate, Navigate } from 'react-router-dom';
import { api, session } from './api.js';
import Listings from './pages/Listings.jsx';
import Login from './pages/Login.jsx';
import Sell from './pages/Sell.jsx';
import MyTransactions from './pages/MyTransactions.jsx';
import Disputes from './pages/Disputes.jsx';
import Audit from './pages/Audit.jsx';
import Payments from './pages/Payments.jsx';

export default function App() {
  const [user, setUser] = useState(session.user);
  const navigate = useNavigate();

  async function logout() {
    try { await api('/auth/logout', { method: 'POST' }); } catch { /* sesion ya invalida */ }
    session.clear();
    setUser(null);
    navigate('/');
  }

  return (
    <>
      <nav>
        <Link to="/" className="brand">🎮 LootMarket</Link>
        <div className="nav-links">
          {user?.role === 'seller' && <Link to="/sell">Vender</Link>}
          {user && <Link to="/transactions">Mis trades</Link>}
          {user && <Link to="/payments">Pagos</Link>}
          {(user?.role === 'moderator' || user?.role === 'admin') && <Link to="/disputes">Disputas</Link>}
          {user?.role === 'admin' && <Link to="/audit">Auditoría</Link>}
        </div>
        <div className="nav-user">
          {user ? (
            <>
              <span className="badge">{user.username} · {user.role}</span>
              <button onClick={logout}>Salir</button>
            </>
          ) : (
            <Link to="/login">Ingresar</Link>
          )}
        </div>
      </nav>
      <main>
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
    </>
  );
}
