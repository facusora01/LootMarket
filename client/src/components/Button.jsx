import { Icon } from './Icon.jsx';

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  leftIcon,
  rightIcon,
  block = false,
  disabled = false,
  type = 'button',
  className = '',
  ...rest
}) {
  const iconSize = size === 'lg' ? 18 : size === 'sm' ? 14 : 16;
  const cls = ['lm-btn', `lm-btn--${variant}`, `lm-btn--${size}`, block ? 'lm-btn--block' : '', className]
    .filter(Boolean).join(' ');
  return (
    <button type={type} className={cls} disabled={disabled} {...rest}>
      {leftIcon && <Icon name={leftIcon} size={iconSize} />}
      {children}
      {rightIcon && <Icon name={rightIcon} size={iconSize} />}
    </button>
  );
}
