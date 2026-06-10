import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Icon } from '../components/Icon.jsx';
import { Button } from '../components/Button.jsx';
import { Badge } from '../components/Badge.jsx';
import { Card } from '../components/Card.jsx';
import { Input } from '../components/Input.jsx';

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
      const g = await api(`/disputes/${requestingFor}/jit`, { method: 'POST', body: { reason: jitReason } });
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
    <div className="lmk-screen">
      <div className="lmk-disputes__head">
        <div>
          <h1>Disputas abiertas</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--space-1)' }}>
            Revisá los casos abiertos. El acceso a datos privados requiere elevación JIT auditada.
          </p>
        </div>
        {disputes.length > 0 && (
          <Badge tone="danger">{disputes.length} activa{disputes.length !== 1 ? 's' : ''}</Badge>
        )}
      </div>

      {msg && <div className="lmk-msg-ok"><Icon name="check-circle" size={16} />{msg}</div>}
      {error && <div className="lmk-msg-err"><Icon name="alert-circle" size={16} />{error}</div>}

      {disputes.length > 0 ? disputes.map((d) => (
        <Card key={d.id} className="lmk-dispute-card">
          <div className="lmk-dispute-card__top">
            <div>
              <div className="lmk-dispute-card__id">
                <Icon name="gavel" size={16} color="var(--red-400)" style={{ display: 'inline-flex', marginRight: 'var(--space-2)' }} />
                Disputa #{d.id} · transacción #{d.transaction_id}
              </div>
              <div className="lmk-dispute-card__meta">{new Date(d.created_at).toLocaleString()}</div>
            </div>
            <Badge tone={d.has_active_jit ? 'ok' : 'warn'} icon={d.has_active_jit ? 'unlock' : 'lock'}>
              {d.has_active_jit ? 'JIT activo' : 'Sin acceso JIT'}
            </Badge>
          </div>

          <div className="lmk-dispute-card__actions">
            {user.role === 'moderator' && !d.has_active_jit && (
              <Button variant="outline" size="sm" leftIcon="key-round" onClick={() => setRequestingFor(requestingFor === d.id ? null : d.id)}>
                Solicitar acceso JIT
              </Button>
            )}
            <Button variant="secondary" size="sm" leftIcon="eye" onClick={() => viewDetail(d.id)}>
              Ver detalle privado
            </Button>
          </div>

          {requestingFor === d.id && (
            <form className="lmk-jit-form" onSubmit={requestJit}>
              <label>Motivo de la elevación (queda en el log forense)</label>
              <input className="lm-input" value={jitReason} onChange={(e) => setJitReason(e.target.value)} required placeholder="Investigación de la transacción..." />
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <Button type="submit" variant="primary" size="sm" leftIcon="key-round">Solicitar (expira en 15 min)</Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setRequestingFor(null)}>Cancelar</Button>
              </div>
            </form>
          )}

          {detail?.id === d.id && (
            <div className="lmk-private-data">
              <h3><Icon name="lock" size={14} /> Detalle privado (acceso privilegiado)</h3>
              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-1)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wide)', fontWeight: 600 }}>Motivo</div>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-body)' }}>{detail.reason}</p>
              </div>
              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-1)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wide)', fontWeight: 600 }}>Datos privados de la cuenta</div>
                <pre>{detail.private_account_data || '(vacío)'}</pre>
              </div>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                Comprador #{detail.buyer_id} · Vendedor #{detail.seller_id} · ${detail.amount}
              </p>
              <div>
                <label className="lm-label" style={{ marginBottom: 'var(--space-2)' }}>Notas de resolución</label>
                <input className="lm-input" value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="Justificación de la decisión..." />
              </div>
              <div className="lmk-resolve-row">
                <Button variant="success" size="sm" leftIcon="undo-2" onClick={() => resolve(d.id, 'buyer')}>Reembolsar al comprador</Button>
                <Button variant="primary" size="sm" leftIcon="circle-dollar-sign" onClick={() => resolve(d.id, 'seller')}>Liberar al vendedor</Button>
              </div>
            </div>
          )}
        </Card>
      )) : (
        <p className="lmk-empty">No hay disputas abiertas.</p>
      )}
    </div>
  );
}
