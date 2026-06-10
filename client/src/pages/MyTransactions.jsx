import { useEffect, useState } from 'react';
import { api, session } from '../api.js';
import { Icon } from '../components/Icon.jsx';
import { Button } from '../components/Button.jsx';
import { EscrowStatus } from '../components/EscrowStatus.jsx';
import { PriceTag } from '../components/PriceTag.jsx';
import { Input } from '../components/Input.jsx';
import { Textarea } from '../components/Textarea.jsx';
import { Card } from '../components/Card.jsx';

export default function MyTransactions() {
  const [txs, setTxs] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [disputing, setDisputing] = useState(null);
  const [reason, setReason] = useState('');
  const [privateData, setPrivateData] = useState('');
  const me = session.user;

  const load = () => api('/transactions/mine').then(setTxs).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function act(path) {
    setError(''); setMsg('');
    try {
      await api(path, { method: 'POST', body: {} });
      setMsg('Acción realizada correctamente.');
      setTimeout(() => setMsg(''), 3000);
      load();
    } catch (err) { setError(err.message); }
  }

  async function openDispute(e) {
    e.preventDefault();
    setError(''); setMsg('');
    try {
      await api(`/transactions/${disputing}/dispute`, {
        method: 'POST',
        body: { reason, privateAccountData: privateData },
      });
      setMsg('Disputa abierta. Un moderador revisará el caso.');
      setDisputing(null); setReason(''); setPrivateData('');
      load();
    } catch (err) { setError(err.message); }
  }

  const held = txs.filter(t => ['escrow_held', 'item_transferred'].includes(t.status)).length;
  const totalMoved = txs.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

  return (
    <div className="lmk-screen lmk-tx">
      <div className="lmk-tx__head">
        <div>
          <h1>Mis transacciones</h1>
          <p>Seguí el estado de cada compra y liberá los fondos cuando recibas el item.</p>
        </div>
        <div className="lmk-tx__summary">
          <div className="lmk-stat"><span>En escrow</span><strong>{held}</strong></div>
          <div className="lmk-stat"><span>Total movido</span><strong>${totalMoved.toFixed(0)}</strong></div>
        </div>
      </div>

      {msg && <div className="lmk-msg-ok"><Icon name="check-circle" size={16} />{msg}</div>}
      {error && <div className="lmk-msg-err"><Icon name="alert-circle" size={16} />{error}</div>}

      {txs.length > 0 ? (
        <div>
          <div className="lmk-table">
            <div className="lmk-table__head">
              <span>Transacción</span>
              <span>Tipo</span>
              <span>Estado</span>
              <span>Monto</span>
              <span></span>
            </div>
            {txs.map((t) => {
              const isBuyer = t.buyer_id === me.id;
              return (
                <div key={t.id}>
                  <div className="lmk-table__row">
                    <div className="lmk-table__cell--main">
                      <div className="lmk-table__title">#{t.id} — {t.listing_title}</div>
                      <div className="lmk-table__id">{new Date(t.created_at).toLocaleString()}</div>
                    </div>
                    <div>
                      <span className={'lm-badge' + (isBuyer ? '' : ' lm-badge--primary')}>
                        {isBuyer ? 'Compra' : 'Venta'}
                      </span>
                    </div>
                    <div><EscrowStatus status={t.status} /></div>
                    <div><PriceTag amount={parseFloat(t.amount)} size="sm" /></div>
                    <div className="lmk-table__act">
                      {!isBuyer && t.status === 'escrow_held' && (
                        <Button variant="primary" size="sm" leftIcon="send" onClick={() => act(`/transactions/${t.id}/transfer`)}>
                          Transferir item
                        </Button>
                      )}
                      {isBuyer && t.status === 'item_transferred' && (
                        <Button variant="success" size="sm" leftIcon="badge-check" onClick={() => act(`/transactions/${t.id}/release`)}>
                          Confirmar recepción
                        </Button>
                      )}
                      {['escrow_held', 'item_transferred'].includes(t.status) && (
                        <Button variant="ghost" size="sm" leftIcon="gavel" onClick={() => setDisputing(disputing === t.id ? null : t.id)}>
                          Disputar
                        </Button>
                      )}
                    </div>
                  </div>
                  {disputing === t.id && (
                    <div style={{ padding: 'var(--space-4) var(--space-5)', background: 'var(--ink-850)', borderBottom: '1px solid var(--border-default)' }}>
                      <form className="lmk-dispute-form" onSubmit={openDispute}>
                        <label>Motivo de la disputa</label>
                        <textarea className="lm-textarea" value={reason} onChange={(e) => setReason(e.target.value)} required rows={2} placeholder="Describí el problema..." />
                        <label>Datos privados de la cuenta (solo visibles para el moderador)</label>
                        <textarea className="lm-textarea" value={privateData} onChange={(e) => setPrivateData(e.target.value)} rows={2} placeholder="Datos opcionales para el moderador..." />
                        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                          <Button type="submit" variant="danger" size="sm" leftIcon="gavel">Enviar disputa</Button>
                          <Button type="button" variant="ghost" size="sm" onClick={() => setDisputing(null)}>Cancelar</Button>
                        </div>
                      </form>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="lmk-empty">Sin transacciones todavía.</p>
      )}
    </div>
  );
}
