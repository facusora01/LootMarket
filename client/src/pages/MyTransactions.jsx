import { useEffect, useState } from 'react';
import { api, session } from '../api.js';

const STATUS_LABELS = {
  escrow_held: ['En escrow', 'warn'],
  item_transferred: ['Item transferido', 'warn'],
  released: ['Completada', 'ok'],
  refunded: ['Reembolsada', 'ok'],
  disputed: ['En disputa', 'danger'],
};

export default function MyTransactions() {
  const [txs, setTxs] = useState([]);
  const [error, setError] = useState('');
  const [disputing, setDisputing] = useState(null);
  const [reason, setReason] = useState('');
  const [privateData, setPrivateData] = useState('');
  const me = session.user;

  const load = () => api('/transactions/mine').then(setTxs).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function act(path) {
    setError('');
    try { await api(path, { method: 'POST', body: {} }); load(); }
    catch (err) { setError(err.message); }
  }

  async function openDispute(e) {
    e.preventDefault();
    setError('');
    try {
      await api(`/transactions/${disputing}/dispute`, {
        method: 'POST',
        body: { reason, privateAccountData: privateData },
      });
      setDisputing(null); setReason(''); setPrivateData('');
      load();
    } catch (err) { setError(err.message); }
  }

  return (
    <div>
      <h1>Mis trades</h1>
      {error && <p className="error">{error}</p>}
      {txs.map((t) => {
        const [label, tone] = STATUS_LABELS[t.status] || [t.status, ''];
        const isBuyer = t.buyer_id === me.id;
        return (
          <div className="card" key={t.id}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <strong>#{t.id} — {t.listing_title}</strong>
                <p className="muted">
                  {isBuyer ? 'Compra' : 'Venta'} · ${t.amount} ·{' '}
                  {new Date(t.created_at).toLocaleString()}
                </p>
              </div>
              <span className={`badge ${tone}`}>{label}</span>
            </div>
            <div className="row" style={{ marginTop: '0.5rem' }}>
              {!isBuyer && t.status === 'escrow_held' && (
                <button onClick={() => act(`/transactions/${t.id}/transfer`)}>
                  Marcar item transferido
                </button>
              )}
              {isBuyer && t.status === 'item_transferred' && (
                <button onClick={() => act(`/transactions/${t.id}/release`)}>
                  Confirmar recepción (liberar escrow)
                </button>
              )}
              {['escrow_held', 'item_transferred'].includes(t.status) && (
                <button className="secondary" onClick={() => setDisputing(t.id)}>
                  Abrir disputa
                </button>
              )}
            </div>
            {disputing === t.id && (
              <form onSubmit={openDispute} style={{ marginTop: '0.8rem' }}>
                <label>Motivo de la disputa</label>
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} required rows={2} />
                <label>Datos privados de la cuenta (solo visibles para moderador con acceso JIT)</label>
                <textarea value={privateData} onChange={(e) => setPrivateData(e.target.value)} rows={2} />
                <div className="row">
                  <button type="submit">Enviar disputa</button>
                  <button type="button" className="secondary" onClick={() => setDisputing(null)}>Cancelar</button>
                </div>
              </form>
            )}
          </div>
        );
      })}
      {txs.length === 0 && <p className="muted">Sin transacciones todavía.</p>}
    </div>
  );
}
