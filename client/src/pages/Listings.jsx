import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { Icon } from '../components/Icon.jsx';
import { Button } from '../components/Button.jsx';
import { ListingCard } from '../components/ListingCard.jsx';

const CATEGORIES = [
  { id: 'all', label: 'Todos', icon: 'layout-grid' },
  { id: 'account', label: 'Cuentas', icon: 'user-round' },
  { id: 'skin', label: 'Skins', icon: 'spray-can' },
  { id: 'item', label: 'Items', icon: 'swords' },
  { id: 'key', label: 'Keys', icon: 'key-round' },
];

export default function Listings({ user }) {
  const [listings, setListings] = useState([]);
  const [cat, setCat] = useState('all');
  const [sort, setSort] = useState('recent'); // recent | price-asc | price-desc
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const gridRef = useRef(null);

  const query = (params.get('q') || '').trim().toLowerCase();

  const load = () => api('/listings').then(setListings).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  function buy(id) {
    setError('');
    api('/transactions', { method: 'POST', body: { listingId: id } })
      .then(() => navigate('/transactions'))
      .catch((err) => setError(err.message));
  }

  function cycleSort() {
    setSort((s) => (s === 'price-asc' ? 'price-desc' : s === 'price-desc' ? 'recent' : 'price-asc'));
  }

  const visible = useMemo(() => {
    let out = cat === 'all' ? listings : listings.filter((l) => l.category === cat);
    if (query) {
      out = out.filter((l) =>
        (l.title || '').toLowerCase().includes(query) ||
        (l.description || '').toLowerCase().includes(query) ||
        (l.seller_username || '').toLowerCase().includes(query));
    }
    if (sort === 'price-asc') out = [...out].sort((a, b) => a.price - b.price);
    else if (sort === 'price-desc') out = [...out].sort((a, b) => b.price - a.price);
    return out;
  }, [listings, cat, query, sort]);

  const sortLabel = sort === 'price-asc' ? 'Precio ↑' : sort === 'price-desc' ? 'Precio ↓' : 'Recientes';

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
            <Button variant="primary" size="lg" leftIcon="search"
              onClick={() => gridRef.current?.scrollIntoView({ behavior: 'smooth' })}>
              Explorar mercado
            </Button>
            {user?.role === 'seller' && (
              <Button variant="outline" size="lg" leftIcon="tag" onClick={() => navigate('/sell')}>
                Vender un item
              </Button>
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

      {error && <div className="lmk-msg-err"><Icon name="alert-circle" size={16} />{error}</div>}

      <div className="lmk-toolbar" ref={gridRef}>
        <div className="lmk-chips">
          {CATEGORIES.map((c) => (
            <button key={c.id} className={'lmk-chip' + (cat === c.id ? ' is-active' : '')} onClick={() => setCat(c.id)}>
              <Icon name={c.icon} size={15} />{c.label}
            </button>
          ))}
        </div>
        <div className="lmk-toolbar__right">
          <button className="lmk-sort" onClick={cycleSort} title="Cambiar orden">
            <Icon name="arrow-up-down" size={14} /> {sortLabel}
          </button>
        </div>
      </div>

      {query && (
        <p className="lmk-empty" style={{ textAlign: 'left', padding: 'var(--space-2) 0', color: 'var(--text-muted)' }}>
          Resultados para “{params.get('q')}” · {visible.length}
        </p>
      )}

      {visible.length > 0 ? (
        <div className="lmk-grid">
          {visible.map((l) => (
            <ListingCard
              key={l.id}
              title={l.title}
              description={l.description}
              category={l.category}
              price={l.price}
              imageUrl={l.image_url}
              sellerName={l.seller_username}
              sellerMasked={l.seller_email_masked}
              buyable={!!(user && user.username !== l.seller_username)}
              onBuy={(e) => { e.stopPropagation(); buy(l.id); }}
              onClick={() => navigate(`/listing/${l.id}`)}
            />
          ))}
        </div>
      ) : (
        <p className="lmk-empty">
          {query ? 'Sin resultados para tu búsqueda.' : 'No hay publicaciones en esta categoría.'}
        </p>
      )}
    </div>
  );
}
