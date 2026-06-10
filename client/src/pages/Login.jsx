import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, session } from '../api.js';

export default function Login({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ username: '', email: '', password: '', role: 'buyer' });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      const path = mode === 'login' ? '/auth/login' : '/auth/register';
      const { user, token } = await api(path, { method: 'POST', body: form });
      session.save(token, user);
      onAuth(user);
      navigate('/');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h1>{mode === 'login' ? 'Ingresar' : 'Crear cuenta'}</h1>
      <form onSubmit={submit}>
        <label>Usuario</label>
        <input value={form.username} onChange={set('username')} required />
        {mode === 'register' && (
          <>
            <label>Email</label>
            <input type="email" value={form.email} onChange={set('email')} required />
            <label>Rol</label>
            <select value={form.role} onChange={set('role')}>
              <option value="buyer">Comprador</option>
              <option value="seller">Vendedor</option>
            </select>
          </>
        )}
        <label>Contraseña</label>
        <input type="password" value={form.password} onChange={set('password')} required />
        {error && <p className="error">{error}</p>}
        <div className="row">
          <button type="submit">{mode === 'login' ? 'Ingresar' : 'Registrarme'}</button>
          <button type="button" className="secondary"
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
            {mode === 'login' ? 'No tengo cuenta' : 'Ya tengo cuenta'}
          </button>
        </div>
      </form>
      <p className="muted" style={{ marginTop: '1rem' }}>
        Usuarios demo (pass <code>password123</code>): ana_buyer, carla_sells, mod_mati, admin_root
      </p>
    </div>
  );
}
