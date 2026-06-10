import { Icon } from './Icon.jsx';

export function Badge({ children, tone = 'neutral', dot = false, icon, className = '', ...rest }) {
  const cls = ['lm-badge', tone !== 'neutral' ? `lm-badge--${tone}` : '', dot ? 'lm-badge--dot' : '', className]
    .filter(Boolean).join(' ');
  return (
    <span className={cls} {...rest}>
      {icon && <Icon name={icon} size={12} />}
      {children}
    </span>
  );
}
