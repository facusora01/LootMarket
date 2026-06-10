import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';

export default function Sell() {
  const [form, setForm] = useState({ title: '', category: 'account', description: '', price: '' });
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      await api('/listings', { method: 'POST', body: { ...form, price: Number(form.price) } });
      navigate('/');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h1>Publicar item</h1>
      <form onSubmit={submit}>
        <label>Título</label>
        <input value={form.title} onChange={set('title')} required maxLength={120} />
        <label>Categoría</label>
        <select value={form.category} onChange={set('category')}>
          <option value="account">Cuenta</option>
          <option value="skin">Skin</option>
          <option value="item">Item</option>
          <option value="key">Key de activación</option>
        </select>
        <label>Descripción</label>
        <textarea value={form.description} onChange={set('description')} rows={3} />
        <label>Precio (USD)</label>
        <input type="number" step="0.01" min="0.01" value={form.price} onChange={set('price')} required />
        {error && <p className="error">{error}</p>}
        <button type="submit">Publicar</button>
      </form>
    </div>
  );
}
