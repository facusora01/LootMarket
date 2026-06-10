import { useEffect, useState } from 'react';
import { api } from '../api.js';

// TP4: la tarjeta se cifra en reposo en la DB (pgp_sym_encrypt). La UI solo
// recibe last4 — el numero completo jamas vuelve a salir.
export default function Payments() {
  const [cards, setCards] = useState([]);
  const [number, setNumber] = useState('');
  const [error, setError] = useState('');

  const load = () => api('/payment-methods').then(setCards).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function add(e) {
    e.preventDefault();
    setError('');
    try {
      await api('/payment-methods', { method: 'POST', body: { cardNumber: number } });
      setNumber('');
      load();
    } catch (err) { setError(err.message); }
  }

  return (
    <div>
      <h1>Medios de pago</h1>
      {error && <p className="error">{error}</p>}
      {cards.map((c) => (
        <div className="card" key={c.id}>
          💳 **** **** **** {c.card_last4}
          <span className="muted"> · guardada cifrada el {new Date(c.created_at).toLocaleDateString()}</span>
        </div>
      ))}
      <form onSubmit={add}>
        <label>Número de tarjeta</label>
        <input value={number} onChange={(e) => setNumber(e.target.value)}
          placeholder="4111 1111 1111 1111" required />
        <button type="submit">Guardar (se cifra en reposo)</button>
      </form>
    </div>
  );
}
