import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Icon } from '../components/Icon.jsx';
import { Button } from '../components/Button.jsx';
import { Card } from '../components/Card.jsx';
import { Badge } from '../components/Badge.jsx';
import { ListingCard } from '../components/ListingCard.jsx';
import { PriceTag } from '../components/PriceTag.jsx';
import { EscrowStatus } from '../components/EscrowStatus.jsx';

const CATEGORIES = [
  { id: 'all', label: 'Todos', icon: 'layout-grid' },
  { id: 'account', label: 'Cuentas', icon: 'user-round' },
  { id: 'skin', label: 'Skins', icon: 'spray-can' },
  { id: 'item', label: 'Items', icon: 'swords' },
  { id: 'key', label: 'Keys', icon: 'key-round' },
];

const CAT_TINT = {
  account: 'var(--indigo-500)',
  skin: 'var(--rarity-epic)',
  item: 'var(--rarity-rare)',
  key: 'var(--green-600)',
};
const CAT_ICON = { account: 'user-round', skin: 'spray-can', item: 'swords', key: 'key-round' };

function DetailView({ listing, onBack, onBuy, bought }) {
  const tint = listing.rarity ? `var(--rarity-${listing.rarity})` : (CAT_TINT[listing.category] || 'var(--indigo-500)');
  return (
    <div className="lmk-screen lmk-detail">
      <button className="lmk-back" onClick={onBack}>
        <Icon name="arrow-left" size={16} /> Volver al mercado
      </button>
      <div className="lmk-detail__grid">
        <div>
          <div className="lmk-detail__thumb" style={{ '--_tint': tint }}>
            <span className="lmk-detail__cat">
              <span className="lm-tag"><Icon name={CAT_ICON[listing.category] || 'package'} size={13} />{listing.category}</span>
            </span>
            <Icon name={CAT_ICON[listing.category] || 'package'} size={104} strokeWidth={1.2} />
            <span className="lmk-detail__bar" />
          </div>
          <div className="lmk-detail__meta">
            <span className="lm-tag"><Icon name="gamepad-2" size={13} />Juego</span>
            <span className="lm-tag"><Icon name="package" size={13} />Entrega manual</span>
            <span className="lm-tag"><Icon name="clock" size={13} />~5 min</span>
          </div>
        </div>
        <div className="lmk-detail__side">
          <h1 className="lmk-detail__title">{listing.title}</h1>
          <p className="lmk-detail__desc">{listing.description}</p>
          <div className="lmk-seller">
            <div style={{ width: 52, height: 52, borderRadius: 999, background: 'var(--surface-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--text-lg)', color: 'var(--text-heading)', flexShrink: 0 }}>
              {(listing.seller_username || '?').slice(0,2).toUpperCase()}
            </div>
            <div className="lmk-seller__info">
              <div className="lmk-seller__name">
                {listing.seller_username} <Icon name="badge-check" size={15} color="var(--indigo-400)" />
              </div>
              <div className="lmk-seller__meta">
                <span className="lmk-seller__mail">{listing.seller_email_masked}</span>
                <Icon name="shield-check" size={12} color="var(--green-500)" />
              </div>
            </div>
          </div>
          <Card className="lmk-buybox">
            <div className="lmk-buybox__top">
              <div>
                <div className="lmk-buybox__label">Precio</div>
                <PriceTag amount={listing.price} size="lg" />
              </div>
              {bought
                ? <EscrowStatus status="escrow_held" />
                : <Badge tone="ok" icon="shield-check">Escrow incluido</Badge>}
            </div>
            <div className="lmk-buybox__line"><span>Precio del item</span><span>${listing.price}</span></div>
            <div className="lmk-buybox__line"><span>Comisión comprador (0%)</span><span>$0.00</span></div>
            <div className="lmk-buybox__line lmk-buybox__total"><span>Total</span><PriceTag amount={listing.price} size="sm" /></div>
            {bought ? (
              <div className="lmk-bought">
                <Icon name="lock" size={16} color="var(--amber-500)" />
                <span>Pago retenido en escrow. Esperá la entrega del vendedor.</span>
              </div>
            ) : (
              <Button variant="primary" size="lg" block leftIcon="lock" onClick={onBuy}>
                Comprar con escrow
              </Button>
            )}
            <div className="lmk-buybox__safe">
              <Icon name="shield-check" size={14} color="var(--green-500)" />
              Protección al comprador · reembolso si no recibís el item
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function Listings({ user }) {
  const [listings, setListings] = useState([]);
  const [cat, setCat] = useState('all');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [detail, setDetail] = useState(null);
  const [boughtIds, setBoughtIds] = useState(new Set());

  const load = () => api('/listings').then(setListings).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function buy(id) {
    setMsg(''); setError('');
    try {
      await api('/transactions', { method: 'POST', body: { listingId: id } });
      setBoughtIds(prev => new Set([...prev, id]));
      setMsg('¡Compra iniciada! El pago quedó retenido en escrow.');
      load();
      setTimeout(() => setMsg(''), 4000);
    } catch (err) {
      setError(err.message);
    }
  }

  const filtered = cat === 'all' ? listings : listings.filter(l => l.category === cat);

  if (detail) {
    const l = listings.find(x => x.id === detail);
    if (l) return (
      <DetailView
        listing={l}
        onBack={() => setDetail(null)}
        onBuy={() => buy(l.id)}
        bought={boughtIds.has(l.id)}
      />
    );
  }

  return (
    <div className="lmk-screen">
      <section className="lmk-hero">
        <div className="lmk-hero__copy">
          <span className="lmk-eyebrow">
            <Icon name="shield-check" size={14} /> Cada compra protegida por escrow
          </span>
          <h1>El mercado peer-to-peer de items, cuentas y keys.</h1>
          <p>Comprá y vendé entre jugadores con el dinero retenido hasta que ambas partes confirman. Sin sorpresas, sin estafas.</p>
          <div className="lmk-hero__cta">
            <Button variant="primary" size="lg" leftIcon="search">Explorar mercado</Button>
            {user?.role === 'seller' && (
              <Button variant="outline" size="lg" leftIcon="tag">Vender un item</Button>
            )}
          </div>
          <div className="lmk-hero__stats">
            <div><strong>48.2k</strong><span>trades cerrados</span></div>
            <div><strong>$1.4M</strong><span>en escrow seguro</span></div>
            <div><strong>4.9</strong><span>rating promedio</span></div>
          </div>
        </div>
        <div className="lmk-hero__panel">
          <div className="lmk-flowcard">
            <div className="lmk-flowcard__head">
              <Icon name="lock" size={15} color="var(--amber-500)" /> Flujo de escrow
            </div>
            {[
              { i: 'credit-card', t: 'Comprador paga', s: 'El dinero entra en escrow', done: true },
              { i: 'send', t: 'Vendedor entrega', s: 'Transfiere el item o key', done: true },
              { i: 'badge-check', t: 'Comprador confirma', s: 'Recibió lo que compró', done: false },
              { i: 'circle-dollar-sign', t: 'Fondos liberados', s: 'El vendedor cobra', done: false },
            ].map((step, n) => (
              <div key={n} className={'lmk-flowstep' + (step.done ? ' is-done' : '')}>
                <span className="lmk-flowstep__dot">
                  <Icon name={step.done ? 'check' : step.i} size={14} />
                </span>
                <div>
                  <div className="lmk-flowstep__t">{step.t}</div>
                  <div className="lmk-flowstep__s">{step.s}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {msg && <div className="lmk-msg-ok"><Icon name="check-circle" size={16} />{msg}</div>}
      {error && <div className="lmk-msg-err"><Icon name="alert-circle" size={16} />{error}</div>}

      <div className="lmk-toolbar">
        <div className="lmk-chips">
          {CATEGORIES.map(c => (
            <button key={c.id} className={'lmk-chip' + (cat === c.id ? ' is-active' : '')} onClick={() => setCat(c.id)}>
              <Icon name={c.icon} size={15} />{c.label}
            </button>
          ))}
        </div>
        <div className="lmk-toolbar__right">
          <div className="lmk-sort"><Icon name="arrow-up-down" size={14} /> Precio</div>
        </div>
      </div>

      {filtered.length > 0 ? (
        <div className="lmk-grid">
          {filtered.map(l => (
            <ListingCard
              key={l.id}
              title={l.title}
              description={l.description}
              category={l.category}
              price={l.price}
              sellerName={l.seller_username}
              sellerMasked={l.seller_email_masked}
              buyable={!!(user && user.username !== l.seller_username)}
              onBuy={(e) => { e.stopPropagation(); buy(l.id); }}
              onClick={() => setDetail(l.id)}
            />
          ))}
        </div>
      ) : (
        <p className="lmk-empty">No hay publicaciones en esta categoría.</p>
      )}
    </div>
  );
}
