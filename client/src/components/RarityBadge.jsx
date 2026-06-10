const LABELS = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' };

export function RarityBadge({ rarity = 'common', children, className = '', ...rest }) {
  return (
    <span className={['lm-rarity', `lm-rarity--${rarity}`, className].filter(Boolean).join(' ')} {...rest}>
      {children || LABELS[rarity] || rarity}
    </span>
  );
}
