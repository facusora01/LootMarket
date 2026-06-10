export function PriceTag({ amount, currency = '$', size = 'md', className = '', ...rest }) {
  const value = typeof amount === 'number'
    ? amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
    : amount;
  return (
    <span className={['lm-price', `lm-price--${size}`, className].filter(Boolean).join(' ')} {...rest}>
      <span className="lm-price__currency">{currency}</span>{value}
    </span>
  );
}
