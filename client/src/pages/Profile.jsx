import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Icon } from '../components/Icon.jsx';
import { Button } from '../components/Button.jsx';
import { Card } from '../components/Card.jsx';
import { Input } from '../components/Input.jsx';
import { Avatar } from '../components/Avatar.jsx';
import { PriceTag } from '../components/PriceTag.jsx';

const LISTING_STATUS = {
  active:    { label: 'Activa',    color: 'var(--green-500)' },
  in_escrow: { label: 'En escrow', color: 'var(--amber-500)' },
  sold:      { label: 'Vendida',   color: 'var(--text-muted)' },
  removed:   { label: 'Removida',  color: 'var(--red-400)' },
};

export default function Profile({ user }) {
  const [listings, setListings] = useState([]);
  const [txs, setTxs] = useState([]);
  const [cards, setCards] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [editId, setEditId] = useState(null);
  const [editPrice, setEditPrice] = useState('');
  const [newCard, setNewCard] = useState('');

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };

  const loadListings = () => api('/listings/mine').then(setListings).catch((e) => setError(e.message));
  const loadTxs = () => api('/transactions/mine').then(setTxs).catch(() => {});
  const loadCards = () => api('/payment-methods').then(setCards).catch(() => {});

  useEffect(() => { loadListings(); loadTxs(); loadCards(); }, []);

  const compras = txs.filter((t) => t.buyer_id === user.id).length;
  const ventas = txs.filter((t) => t.seller_id === user.id).length;

  async function savePrice(id) {
    setError('');
    try {
      await api(`/listings/${id}/price`, { method: 'PATCH', body: { price: Number(editPrice) } });
      setEditId(null); setEditPrice('');
      flash('Precio actualizado.');
      loadListings();
    } catch (err) { setError(err.message); }
  }

  async function removeListing(id) {
    if (!window.confirm('¿Borrar este listing? No se puede deshacer.')) return;
    setError('');
    try {
      await api(`/listings/${id}`, { method: 'DELETE' });
      flash('Listing borrado.');
      loadListings();
    } catch (err) { setError(err.message); }
  }

  async function addCard(e) {
    e.preventDefault();
    setError('');
    try {
      await api('/payment-methods', { method: 'POST', body: { cardNumber: newCard } });
      setNewCard('');
      flash('Tarjeta guardada cifrada.');
      loadCards();
    } catch (err) { setError(err.message); }
  }

  return (
    <div className="lmk-screen lmk-profile">
      <div className="lmk-profile__head">
        <Avatar name={user.username} size="lg" status="online" />
        <div>
          <h1>{user.username}</h1>
          <p>Tu cuenta puede comprar y vender. Gestioná tus datos, publicaciones y pagos.</p>
        </div>
      </div>

      {msg && <div className="lmk-msg-ok"><Icon name="check-circle" size={16} />{msg}</div>}
      {error && <div className="lmk-msg-err"><Icon name="alert-circle" size={16} />{error}</div>}

      {/* ---- Mis datos ---- */}
      <section className="lmk-profile__section">
        <h2><Icon name="user-round" size={18} /> Mis datos</h2>
        <div className="lmk-profile__data">
          <div><span>Usuario</span><strong>{user.username}</strong></div>
          <div><span>Email</span><strong>{user.email}</strong></div>
          <div><span>Rol</span><strong>{user.role}</strong></div>
          <div><span>Miembro desde</span><strong>{user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}</strong></div>
        </div>
      </section>

      {/* ---- Resumen de trades ---- */}
      <section className="lmk-profile__section">
        <h2><Icon name="repeat" size={18} /> Mis transacciones</h2>
        <div className="lmk-profile__stats">
          <div className="lmk-stat"><span>Compras</span><strong>{compras}</strong></div>
          <div className="lmk-stat"><span>Ventas</span><strong>{ventas}</strong></div>
          <Link to="/transactions" className="lm-btn lm-btn--outline lm-btn--sm">Ver detalle</Link>
        </div>
      </section>

      {/* ---- Mis publicaciones ---- */}
      <section className="lmk-profile__section">
        <h2><Icon name="tag" size={18} /> Mis publicaciones ({listings.length})</h2>
        {listings.length > 0 ? (
          <div className="lmk-profile__listings">
            {listings.map((l) => {
              const st = LISTING_STATUS[l.status] || LISTING_STATUS.active;
              const editing = editId === l.id;
              return (
                <Card key={l.id} className="lmk-mylisting">
                  <div className="lmk-mylisting__main">
                    <Link to={`/listing/${l.id}`} className="lmk-mylisting__title">{l.title}</Link>
                    <span className="lmk-mylisting__meta">
                      {l.category} · <span style={{ color: st.color }}>{st.label}</span>
                    </span>
                  </div>
                  {editing ? (
                    <div className="lmk-mylisting__edit">
                      <Input value={editPrice} onChange={(e) => setEditPrice(e.target.value)} type="number" step="0.01" min="0.01" icon="dollar-sign" />
                      <Button variant="success" size="sm" leftIcon="check" onClick={() => savePrice(l.id)}>Guardar</Button>
                      <Button variant="ghost" size="sm" onClick={() => { setEditId(null); setEditPrice(''); }}>Cancelar</Button>
                    </div>
                  ) : (
                    <div className="lmk-mylisting__actions">
                      <PriceTag amount={Number(l.price)} size="sm" />
                      {l.status === 'active' && (
                        <>
                          <Button variant="outline" size="sm" leftIcon="pencil" onClick={() => { setEditId(l.id); setEditPrice(String(l.price)); }}>Precio</Button>
                          <Button variant="danger" size="sm" leftIcon="trash-2" onClick={() => removeListing(l.id)}>Borrar</Button>
                        </>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        ) : (
          <p className="lmk-empty">
            No tenés publicaciones. <Link to="/sell">Publicá tu primer item</Link>.
          </p>
        )}
      </section>

      {/* ---- Mis pagos ---- */}
      <section className="lmk-profile__section">
        <h2><Icon name="credit-card" size={18} /> Mis medios de pago</h2>
        <div className="lmk-profile__cards">
          {cards.length > 0 ? cards.map((c) => (
            <div key={c.id} className="lmk-card-item">
              <div className="lmk-card-item__icon"><Icon name="credit-card" size={20} /></div>
              <div className="lmk-card-item__info">
                <div className="lmk-card-item__number">**** **** **** {c.card_last4}</div>
                <div className="lmk-card-item__date">Guardada el {new Date(c.created_at).toLocaleDateString()}</div>
              </div>
              <Icon name="shield-check" size={16} color="var(--green-500)" />
            </div>
          )) : (
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>No hay tarjetas guardadas.</p>
          )}
          <form className="lmk-profile__addcard" onSubmit={addCard}>
            <Input label="Agregar tarjeta (se cifra en reposo)" icon="credit-card" value={newCard} onChange={(e) => setNewCard(e.target.value)} placeholder="4111 1111 1111 1111" required />
            <Button type="submit" variant="primary" size="md" leftIcon="lock">Guardar</Button>
          </form>
        </div>
      </section>
    </div>
  );
}
