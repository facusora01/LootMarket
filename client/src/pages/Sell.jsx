import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { Icon } from '../components/Icon.jsx';
import { Button } from '../components/Button.jsx';
import { Input } from '../components/Input.jsx';
import { Select } from '../components/Select.jsx';
import { Textarea } from '../components/Textarea.jsx';
import { Switch } from '../components/Switch.jsx';
import { Card } from '../components/Card.jsx';
import { ListingCard } from '../components/ListingCard.jsx';

export default function Sell() {
  const [form, setForm] = useState({ title: '', category: 'account', description: '', price: '' });
  const [rarity, setRarity] = useState('');
  const [escrowOnly, setEscrowOnly] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const fee = parseFloat(form.price || 0) * 0.05;
  const net = parseFloat(form.price || 0) - fee;

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
    <div className="lmk-screen lmk-sell">
      <div className="lmk-sell__head">
        <h1>Publicar un item</h1>
        <p>Tu listing aparece en el mercado al instante. Cobrás cuando el comprador confirma la entrega.</p>
      </div>

      <div className="lmk-sell__grid">
        <Card className="lmk-sell__form" as="form" onSubmit={submit}>
          <Input label="Título del listing" icon="tag" value={form.title} onChange={set('title')} required maxLength={120} placeholder="AK-47 | Redline (Field-Tested)" />
          <Textarea label="Descripción" value={form.description} onChange={set('description')} rows={3} help="Incluí floats, stickers, qué incluye la entrega." placeholder="Float 0.009 · pattern limpio · entrega al instante" />
          <div className="lmk-sell__row">
            <Select label="Categoría" value={form.category} onChange={set('category')}>
              <option value="account">Cuenta</option>
              <option value="skin">Skin</option>
              <option value="item">Item</option>
              <option value="key">Key de activación</option>
            </Select>
            <Select label="Rareza" value={rarity} onChange={(e) => setRarity(e.target.value)}>
              <option value="">Sin rareza</option>
              <option value="common">Common</option>
              <option value="uncommon">Uncommon</option>
              <option value="rare">Rare</option>
              <option value="epic">Epic</option>
              <option value="legendary">Legendary</option>
            </Select>
          </div>
          <Input label="Precio (USD)" icon="dollar-sign" type="number" step="0.01" min="0.01" value={form.price} onChange={set('price')} required placeholder="0.00" />
          <div className="lmk-sell__switch">
            <Switch checked={escrowOnly} onChange={setEscrowOnly} label="Aceptar solo compras con escrow" />
          </div>
          {form.price && (
            <div className="lmk-payout">
              <div>
                <span>Vos recibís</span>
                <strong>${net.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
              </div>
              <div className="lmk-payout__fee">Comisión LootMarket 5% · ${fee.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
            </div>
          )}
          {error && <div className="lmk-msg-err"><Icon name="alert-circle" size={16} />{error}</div>}
          <Button type="submit" variant="primary" size="lg" block leftIcon="upload">Publicar listing</Button>
        </Card>

        <div className="lmk-sell__preview">
          <div className="lmk-sell__previewlabel"><Icon name="eye" size={14} /> Vista previa</div>
          <ListingCard
            title={form.title || 'Tu item'}
            description={form.description}
            category={form.category}
            rarity={rarity || undefined}
            price={parseFloat(form.price || 0)}
            sellerName="tu_usuario"
            sellerMasked="t***@***.com"
            buyable={false}
          />
        </div>
      </div>
    </div>
  );
}
