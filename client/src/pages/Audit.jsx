import { useEffect, useState } from 'react';
import { api } from '../api.js';

// TP7: vista forense para el admin. Permite rastrear una transaccion disputada
// completa: quien listo el item, quien compro, transferencia, y modificaciones
// posteriores de precio/estado — cada fila con before/after image y actor.
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
      setTitle(`Rastreo forense de la transacción #${txId}`);
    } catch (err) { setError(err.message); }
  }

  return (
    <div>
      <h1>Auditoría forense</h1>
      <form onSubmit={trace} className="row" style={{ maxWidth: 'none', marginBottom: '1rem' }}>
        <input style={{ width: 220, marginBottom: 0 }} type="number" min="1"
          placeholder="ID de transacción" value={txId}
          onChange={(e) => setTxId(e.target.value)} required />
        <button type="submit">Rastrear transacción</button>
        <button type="button" className="secondary" onClick={loadRecent}>Ver recientes</button>
      </form>
      {error && <p className="error">{error}</p>}
      <h2>{title}</h2>
      <table>
        <thead>
          <tr>
            <th>#</th><th>Cuándo</th><th>Tabla</th><th>Op</th><th>Fila</th>
            <th>Actor</th><th>Before</th><th>After</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.id}</td>
              <td>{new Date(r.at).toLocaleString()}</td>
              <td>{r.table_name}</td>
              <td>{r.operation}</td>
              <td>{r.row_id}</td>
              <td>{r.actor_id || '—'}</td>
              <td>{r.before_img ? <pre>{JSON.stringify(r.before_img, null, 1)}</pre> : '—'}</td>
              <td>{r.after_img ? <pre>{JSON.stringify(r.after_img, null, 1)}</pre> : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="muted">Sin eventos.</p>}
    </div>
  );
}
