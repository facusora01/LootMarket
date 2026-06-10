import { useEffect, useState } from 'react';
import { api } from '../api.js';

const CATEGORY_LABELS = { account: 'Cuenta', skin: 'Skin', item: 'Item', key: 'Key' };

export default function Listings({ user }) {
  const [listings, setListings] = useState([]);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const load = () => api('/listings').then(setListings).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function buy(id) {
    setMsg(''); setError('');
    try {
      await api('/transactions', { method: 'POST', body: { listingId: id } });
      setMsg('Compra iniciada: el pago quedó retenido en escrow hasta que confirmes la entrega.');
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h1>Marketplace</h1>
      {msg && <p className="success">{msg}</p>}
      {error && <p className="error">{error}</p>}
      <div className="grid">
        {listings.map((l) => (
          <div className="card" key={l.id}>
            <span className="badge">{CATEGORY_LABELS[l.category]}</span>
            <h2>{l.title}</h2>
            <p className="muted">{l.description}</p>
            <p className="muted">
              Vendedor: {l.seller_username} · {l.seller_email_masked}
              {' '}<span title="Email enmascarado por DDM — el comprador nunca ve el real">🛡️</span>
            </p>
            <div className="row" style={{ justifyContent: 'space-between', marginTop: '0.5rem' }}>
              <span className="price">${l.price}</span>
              {user && user.username !== l.seller_username && (
                <button onClick={() => buy(l.id)}>Comprar (escrow)</button>
              )}
            </div>
          </div>
        ))}
      </div>
      {listings.length === 0 && !error && <p className="muted">No hay publicaciones activas.</p>}
    </div>
  );
}
