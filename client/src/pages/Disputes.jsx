import { useEffect, useState } from 'react';
import { api } from '../api.js';

// Panel de moderacion. Flujo TP8 (JIT):
// 1. El moderador ve solo metadatos de disputas abiertas.
// 2. Para ver datos privados pide elevacion JIT con motivo → grant de 15 min.
// 3. RLS en Postgres deniega el detalle sin grant vigente, aunque el rol sea moderator.
export default function Disputes({ user }) {
  const [disputes, setDisputes] = useState([]);
  const [detail, setDetail] = useState(null);
  const [jitReason, setJitReason] = useState('');
  const [requestingFor, setRequestingFor] = useState(null);
  const [resolution, setResolution] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = () => api('/disputes').then(setDisputes).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function requestJit(e) {
    e.preventDefault();
    setError(''); setMsg('');
    try {
      const g = await api(`/disputes/${requestingFor}/jit`, {
        method: 'POST', body: { reason: jitReason },
      });
      setMsg(`Acceso JIT otorgado hasta ${new Date(g.expires_at).toLocaleTimeString()} (15 min). Quedó auditado.`);
      setRequestingFor(null); setJitReason('');
      load();
    } catch (err) { setError(err.message); }
  }

  async function viewDetail(id) {
    setError(''); setDetail(null);
    try { setDetail(await api(`/disputes/${id}`)); }
    catch (err) { setError(err.message); }
  }

  async function resolve(id, winner) {
    setError(''); setMsg('');
    try {
      await api(`/disputes/${id}/resolve`, { method: 'POST', body: { winner, resolution } });
      setMsg(`Disputa #${id} resuelta a favor del ${winner === 'buyer' ? 'comprador (reembolso)' : 'vendedor (liberación)'}.`);
      setDetail(null); setResolution('');
      load();
    } catch (err) { setError(err.message); }
  }

  return (
    <div>
      <h1>Disputas abiertas</h1>
      {msg && <p className="success">{msg}</p>}
      {error && <p className="error">{error}</p>}
      {disputes.map((d) => (
        <div className="card" key={d.id}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div>
              <strong>Disputa #{d.id}</strong> · transacción #{d.transaction_id}
              <p className="muted">{new Date(d.created_at).toLocaleString()}</p>
            </div>
            <span className={`badge ${d.has_active_jit ? 'ok' : 'warn'}`}>
              {d.has_active_jit ? 'JIT activo' : 'Sin acceso JIT'}
            </span>
          </div>
          <div className="row" style={{ marginTop: '0.5rem' }}>
            {user.role === 'moderator' && !d.has_active_jit && (
              <button onClick={() => setRequestingFor(d.id)}>Solicitar acceso JIT</button>
            )}
            <button className="secondary" onClick={() => viewDetail(d.id)}>
              Ver detalle privado
            </button>
          </div>
          {requestingFor === d.id && (
            <form onSubmit={requestJit} style={{ marginTop: '0.8rem' }}>
              <label>Motivo de la elevación (obligatorio, queda en el log forense)</label>
              <input value={jitReason} onChange={(e) => setJitReason(e.target.value)} required />
              <div className="row">
                <button type="submit">Solicitar (expira en 15 min)</button>
                <button type="button" className="secondary" onClick={() => setRequestingFor(null)}>Cancelar</button>
              </div>
            </form>
          )}
          {detail?.id === d.id && (
            <div style={{ marginTop: '0.8rem' }}>
              <h2>Detalle (acceso privilegiado)</h2>
              <p><strong>Motivo:</strong> {detail.reason}</p>
              <p><strong>Datos privados de la cuenta:</strong></p>
              <pre style={{ maxWidth: '100%' }}>{detail.private_account_data || '(vacío)'}</pre>
              <p className="muted">
                Comprador #{detail.buyer_id} · Vendedor #{detail.seller_id} · ${detail.amount}
              </p>
              <label>Resolución</label>
              <input value={resolution} onChange={(e) => setResolution(e.target.value)}
                placeholder="Notas de la resolución" />
              <div className="row">
                <button onClick={() => resolve(d.id, 'buyer')}>Reembolsar al comprador</button>
                <button onClick={() => resolve(d.id, 'seller')}>Liberar al vendedor</button>
              </div>
            </div>
          )}
        </div>
      ))}
      {disputes.length === 0 && <p className="muted">No hay disputas abiertas.</p>}
    </div>
  );
}
