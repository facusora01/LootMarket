export function Avatar({ src, name = '', size = 'md', status, className = '', ...rest }) {
  const initials = name.trim().slice(0, 2).toUpperCase();
  const cls = ['lm-avatar', `lm-avatar--${size}`, className].filter(Boolean).join(' ');
  return (
    <span className={cls} {...rest}>
      {src ? <img src={src} alt={name} /> : <span>{initials || '?'}</span>}
      {status && <span className={`lm-avatar__status lm-avatar__status--${status}`} />}
    </span>
  );
}
