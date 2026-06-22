export function Skeleton({ variant = 'text', width, height, count = 1, className = '', ...rest }) {
  const items = Array.from({ length: count }, (_, i) => i);
  return items.map((i) => (
    <div
      key={i}
      className={['lm-skeleton', `lm-skeleton--${variant}`, className].filter(Boolean).join(' ')}
      style={{ width, height }}
      aria-hidden="true"
      {...rest}
    />
  ));
}
