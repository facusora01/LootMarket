import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, session } from '../api.js';
import { Icon } from '../components/Icon.jsx';
import { Button } from '../components/Button.jsx';
import { Input } from '../components/Input.jsx';
import { Select } from '../components/Select.jsx';

export default function Login({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ username: '', email: '', password: '' });
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
    <div className="lmk-login" style={{ marginLeft: 'calc(var(--space-6) * -1)', marginRight: 'calc(var(--space-6) * -1)', marginTop: 'calc(var(--space-8) * -1)' }}>
      <div className="lmk-login__brand">
        <div className="lmk-login__brand-top">
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-heading)' }}>
            Loot<span style={{ color: 'var(--green-500)' }}>Market</span>
          </div>
          <div className="lmk-login__pitch">
            <h2>El loot cambia de manos.<br />El dinero queda protegido.</h2>
            <ul>
              <li><Icon name="lock" size={16} color="var(--amber-500)" /> Escrow en cada trade</li>
              <li><Icon name="shield-check" size={16} color="var(--green-500)" /> Reembolso garantizado</li>
              <li><Icon name="gavel" size={16} color="var(--indigo-400)" /> Disputas con moderación humana</li>
            </ul>
          </div>
        </div>
        <div className="lmk-login__crate">
          <Icon name="package" size={200} strokeWidth={1} />
        </div>
      </div>

      <div className="lmk-login__panel">
        <form className="lmk-login__form" onSubmit={submit}>
          <h1>{mode === 'login' ? 'Entrá a tu cuenta' : 'Crear cuenta'}</h1>
          <p>{mode === 'login' ? 'Comprá y vendé items con protección de escrow.' : 'Unite al mercado peer-to-peer más seguro.'}</p>

          <Input label="Usuario" icon="user" placeholder="ana_buyer" value={form.username} onChange={set('username')} required />

          {mode === 'register' && (
            <>
              <Input label="Email" icon="mail" type="email" placeholder="ana@mail.com" value={form.email} onChange={set('email')} required />
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0 }}>
                Tu cuenta puede comprar y vender. Sin elegir rol.
              </p>
            </>
          )}

          <Input label="Contraseña" icon="lock" type="password" placeholder="••••••••" value={form.password} onChange={set('password')} required />

          {error && <div className="lmk-msg-err"><Icon name="alert-circle" size={16} />{error}</div>}

          <Button type="submit" variant="primary" size="lg" block>
            {mode === 'login' ? 'Iniciar sesión' : 'Registrarme'}
          </Button>

          <div className="lmk-login__foot">
            {mode === 'login' ? '¿No tenés cuenta? ' : '¿Ya tenés cuenta? '}
            <a href="#" onClick={(e) => { e.preventDefault(); setMode(mode === 'login' ? 'register' : 'login'); }}>
              {mode === 'login' ? 'Registrate gratis' : 'Iniciá sesión'}
            </a>
          </div>

          <div style={{ padding: 'var(--space-3)', background: 'var(--surface-overlay)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            Demo — pass <strong style={{ color: 'var(--text-secondary)' }}>password123</strong>: ana_buyer · carla_sells · mod_mati · admin_root
          </div>
        </form>
      </div>
    </div>
  );
}
