import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Icon } from '../components/Icon.jsx';
import { Button } from '../components/Button.jsx';
import { Card } from '../components/Card.jsx';
import { Input } from '../components/Input.jsx';

export default function Payments() {
  const [cards, setCards] = useState([]);
  const [number, setNumber] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = () => api('/payment-methods').then(setCards).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function add(e) {
    e.preventDefault();
    setError(''); setMsg('');
    try {
      await api('/payment-methods', { method: 'POST', body: { cardNumber: number } });
      setNumber('');
      setMsg('Tarjeta guardada cifrada.');
      setTimeout(() => setMsg(''), 3000);
      load();
    } catch (err) { setError(err.message); }
  }

  return (
    <div className="lmk-screen">
      <div className="lmk-payments__head">
        <h1>Medios de pago</h1>
        <p>Los números completos nunca se almacenan en texto plano — se cifran en reposo.</p>
      </div>

      {msg && <div className="lmk-msg-ok"><Icon name="check-circle" size={16} />{msg}</div>}
      {error && <div className="lmk-msg-err"><Icon name="alert-circle" size={16} />{error}</div>}

      <div className="lmk-payments__grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wide)', color: 'var(--text-muted)', fontWeight: 600 }}>
            Tarjetas guardadas
          </div>
          {cards.length > 0 ? cards.map((c) => (
            <Card key={c.id}>
              <div className="lmk-card-item">
                <div className="lmk-card-item__icon">
                  <Icon name="credit-card" size={20} />
                </div>
                <div className="lmk-card-item__info">
                  <div className="lmk-card-item__number">**** **** **** {c.card_last4}</div>
                  <div className="lmk-card-item__date">Guardada el {new Date(c.created_at).toLocaleDateString()}</div>
                </div>
                <Icon name="shield-check" size={16} color="var(--green-500)" />
              </div>
            </Card>
          )) : (
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>No hay tarjetas guardadas.</p>
          )}
        </div>

        <Card>
          <form className="lmk-add-form" onSubmit={add}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
              <Icon name="credit-card" size={18} color="var(--indigo-400)" />
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-heading)' }}>Agregar tarjeta</span>
            </div>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>
              El número se cifra con pgp_sym_encrypt antes de guardarse.
            </p>
            <Input
              label="Número de tarjeta"
              icon="credit-card"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="4111 1111 1111 1111"
              required
            />
            <Button type="submit" variant="primary" size="md" block leftIcon="lock">
              Guardar (se cifra en reposo)
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
