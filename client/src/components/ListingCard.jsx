import { Icon } from './Icon.jsx';
import { Avatar } from './Avatar.jsx';
import { PriceTag } from './PriceTag.jsx';
import { RarityBadge } from './RarityBadge.jsx';
import { Button } from './Button.jsx';

const CATEGORIES = {
  account: { label: 'Cuenta', icon: 'user-round', tint: 'var(--indigo-600)' },
  skin:    { label: 'Skin',   icon: 'spray-can',  tint: 'var(--rarity-epic)' },
  item:    { label: 'Item',   icon: 'swords',     tint: 'var(--rarity-rare)' },
  key:     { label: 'Key',    icon: 'key-round',  tint: 'var(--green-600)' },
};

export function ListingCard({
  title, description, category = 'item', rarity, price, currency = '$', imageUrl,
  sellerName, sellerMasked, sellerAvatar, buyable = true, onBuy, className = '', ...rest
}) {
  const cat = CATEGORIES[category] || CATEGORIES.item;
  const tint = rarity ? `var(--rarity-${rarity})` : cat.tint;
  return (
    <article
      className={['lm-listing', 'lm-listing--interactive', className].filter(Boolean).join(' ')}
      style={{ ['--_tint']: tint }}
      {...rest}
    >
      <div className="lm-listing__thumb">
        <span className="lm-listing__cat">
          <span className="lm-tag"><Icon name={cat.icon} size={13} />{cat.label}</span>
        </span>
        {imageUrl ? (
          <img
            className="lm-listing__img"
            src={imageUrl}
            alt={title}
            loading="lazy"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        ) : (
          <span className="lm-listing__thumb-icon"><Icon name={cat.icon} size={56} strokeWidth={1.5} /></span>
        )}
        <span className="lm-listing__rarity-bar" />
      </div>
      <div className="lm-listing__body">
        {rarity && <RarityBadge rarity={rarity} />}
        <h3 className="lm-listing__title">{title}</h3>
        {description && <p className="lm-listing__desc">{description}</p>}
        <div className="lm-listing__seller">
          <Avatar name={sellerName} size="sm" />
          <span>{sellerName}</span>
          {sellerMasked && (
            <>
              <span>·</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>{sellerMasked}</span>
              <Icon name="shield-check" size={13} color="var(--green-500)" />
            </>
          )}
        </div>
      </div>
      <div className="lm-listing__foot">
        <PriceTag amount={price} currency={currency} size="md" />
        {buyable && (
          <Button variant="primary" size="sm" leftIcon="lock" onClick={onBuy}>Comprar</Button>
        )}
      </div>
    </article>
  );
}
