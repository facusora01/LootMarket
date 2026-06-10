import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Icon } from '../components/Icon.jsx';
import { Button } from '../components/Button.jsx';
import { Input } from '../components/Input.jsx';

export default function Audit() {
  const [rows, setRows] = useState([]);
  const [txId, setTxId] = useState('');
  const [error, setError] = useState('');
  const [title, setTitle] = useState('Últimos eventos');

  const loadRecent = () => {
    setTitle('Últimos eventos');
    api('/admin/audit').then(setRows).catch((e) => setError(e.message));
  };
  useEffect(() => { loadRecent(); }, []);

  async function trace(e) {
    e.preventDefault();
    setError('');
    try {
      setRows(await api(`/admin/audit/transaction/${txId}`));
      setTitle(`Rastreo forense · transacción #${txId}`);
    } catch (err) { setError(err.message); }
  }

  const opColor = { INSERT: 'lmk-op-insert', UPDATE: 'lmk-op-update', DELETE: 'lmk-op-delete' };

  return (
    <div className="lmk-screen">
      <div className="lmk-audit__head">
        <div>
          <h1>Auditoría forense</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--space-1)' }}>
            Rastreá transacciones y eventos del sistema con trazabilidad completa.
          </p>
        </div>
        <div className="lmk-audit__search">
          <form onSubmit={trace} style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end' }}>
            <Input
              label="ID de transacción"
              icon="search"
              type="number"
              min="1"
              placeholder="123"
              value={txId}
              onChange={(e) => setTxId(e.target.value)}
              required
              style={{ width: 200 }}
            />
            <Button type="submit" variant="primary" size="md" leftIcon="search">Rastrear</Button>
            <Button type="button" variant="secondary" size="md" leftIcon="clock" onClick={loadRecent}>Recientes</Button>
          </form>
        </div>
      </div>

      {error && <div className="lmk-msg-err"><Icon name="alert-circle" size={16} />{error}</div>}

      <div>
        <div style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wide)', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 'var(--space-3)' }}>
          {title}
        </div>
        <div className="lmk-audit-table">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Cuándo</th>
                <th>Tabla</th>
                <th>Op</th>
                <th>Fila</th>
                <th>Actor</th>
                <th>Before</th>
                <th>After</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-faint)' }}>{r.id}</td>
                  <td style={{ whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>{new Date(r.at).toLocaleString()}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--indigo-300)' }}>{r.table_name}</td>
                  <td><span className={opColor[r.operation] || ''}>{r.operation}</span></td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{r.row_id}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{r.actor_id || '—'}</td>
                  <td>{r.before_img ? <pre>{JSON.stringify(r.before_img, null, 1)}</pre> : <span style={{ color: 'var(--text-faint)' }}>—</span>}</td>
                  <td>{r.after_img ? <pre>{JSON.stringify(r.after_img, null, 1)}</pre> : <span style={{ color: 'var(--text-faint)' }}>—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p className="lmk-empty">Sin eventos.</p>}
        </div>
      </div>
    </div>
  );
}
