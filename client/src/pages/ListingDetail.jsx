import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { Icon } from '../components/Icon.jsx';
import { Button } from '../components/Button.jsx';
import { Card } from '../components/Card.jsx';
import { Badge } from '../components/Badge.jsx';
import { PriceTag } from '../components/PriceTag.jsx';
import { EscrowStatus } from '../components/EscrowStatus.jsx';

const CAT_TINT = {
  account: 'var(--indigo-500)',
  skin: 'var(--rarity-epic)',
  item: 'var(--rarity-rare)',
  key: 'var(--green-600)',
};
const CAT_ICON = { account: 'user-round', skin: 'spray-can', item: 'swords', key: 'key-round' };

export default function ListingDetail({ user }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [listing, setListing] = useState(null);
  const [error, setError] = useState('');
  const [bought, setBought] = useState(false);

  useEffect(() => {
    setError(''); setListing(null);
    api(`/listings/${id}`).then(setListing).catch((e) => setError(e.message));
  }, [id]);

  async function buy() {
    setError('');
    try {
      await api('/transactions', { method: 'POST', body: { listingId: listing.id } });
      setBought(true);
    } catch (err) {
      setError(err.message);
    }
  }

  function back() {
    // Volver a la pantalla previa si existe historial propio; si no, al mercado.
    if (window.history.state && window.history.state.idx > 0) navigate(-1);
    else navigate('/');
  }

  if (error) {
    return (
      <div className="lmk-screen lmk-detail">
        <button className="lmk-back" onClick={back}>
          <Icon name="arrow-left" size={16} /> Volver al mercado
        </button>
        <div className="lmk-msg-err"><Icon name="alert-circle" size={16} />{error}</div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="lmk-screen lmk-detail">
        <p className="lmk-empty">Cargando publicación…</p>
      </div>
    );
  }

  const tint = listing.rarity ? `var(--rarity-${listing.rarity})` : (CAT_TINT[listing.category] || 'var(--indigo-500)');
  const canBuy = !!(user && user.username !== listing.seller_username);

  return (
    <div className="lmk-screen lmk-detail">
      <button className="lmk-back" onClick={back}>
        <Icon name="arrow-left" size={16} /> Volver al mercado
      </button>
      <div className="lmk-detail__grid">
        <div>
          <div className="lmk-detail__thumb" style={{ '--_tint': tint }}>
            <span className="lmk-detail__cat">
              <span className="lm-tag"><Icon name={CAT_ICON[listing.category] || 'package'} size={13} />{listing.category}</span>
            </span>
            {listing.image_url ? (
              <img
                className="lmk-detail__img"
                src={listing.image_url}
                alt={listing.title}
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            ) : (
              <Icon name={CAT_ICON[listing.category] || 'package'} size={104} strokeWidth={1.2} />
            )}
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
              {(listing.seller_username || '?').slice(0, 2).toUpperCase()}
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
            ) : canBuy ? (
              <Button variant="primary" size="lg" block leftIcon="lock" onClick={buy}>
                Comprar con escrow
              </Button>
            ) : (
              <Button variant="outline" size="lg" block disabled>
                {user ? 'Es tu propia publicación' : 'Ingresá para comprar'}
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
