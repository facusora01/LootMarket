import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { Icon } from '../components/Icon.jsx';
import { Button } from '../components/Button.jsx';
import { Input } from '../components/Input.jsx';

const COLS = [
  { key: 'id', label: '#' },
  { key: 'at', label: 'Cuándo' },
  { key: 'table_name', label: 'Tabla' },
  { key: 'operation', label: 'Op' },
  { key: 'row_id', label: 'Fila' },
  { key: 'actor_id', label: 'Actor' },
  { key: 'before_img', label: 'Before' },
  { key: 'after_img', label: 'After' },
];

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

  // Ordenamiento client-side: click en un header alterna asc/desc.
  const [sortKey, setSortKey] = useState('id');
  const [sortDir, setSortDir] = useState('desc');

  function toggleSort(key) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  }

  const sortedRows = useMemo(() => {
    const val = (r) => {
      if (sortKey === 'at') return new Date(r.at).getTime();
      if (sortKey === 'id' || sortKey === 'row_id') return Number(r[sortKey]) || 0;
      if (sortKey === 'before_img' || sortKey === 'after_img') return r[sortKey] ? JSON.stringify(r[sortKey]) : '';
      return (r[sortKey] ?? '').toString().toLowerCase();
    };
    return [...rows].sort((a, b) => {
      const va = val(a), vb = val(b);
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [rows, sortKey, sortDir]);

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
                {COLS.map((c) => (
                  <th
                    key={c.key}
                    onClick={() => toggleSort(c.key)}
                    style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                    title="Ordenar"
                  >
                    {c.label}
                    <span style={{ color: 'var(--text-faint)', marginLeft: 4 }}>
                      {sortKey === c.key ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((r) => (
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
