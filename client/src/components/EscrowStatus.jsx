import { Icon } from './Icon.jsx';

const STATES = {
  active:           { label: 'Activa',           fg: 'var(--cloud-300)',  bg: 'var(--ink-700)',   icon: 'circle' },
  escrow_held:      { label: 'En escrow',         fg: 'var(--amber-500)', bg: 'var(--amber-ink)', icon: 'lock' },
  item_transferred: { label: 'Item transferido',  fg: 'var(--amber-500)', bg: 'var(--amber-ink)', icon: 'send' },
  released:         { label: 'Completada',         fg: 'var(--green-500)', bg: 'var(--green-ink)', icon: 'check' },
  refunded:         { label: 'Reembolsada',        fg: 'var(--green-500)', bg: 'var(--green-ink)', icon: 'undo-2' },
  disputed:         { label: 'En disputa',         fg: 'var(--red-400)',   bg: 'var(--red-ink)',   icon: 'gavel' },
};

export function EscrowStatus({ status = 'escrow_held', label, showIcon = true, className = '', ...rest }) {
  const s = STATES[status] || STATES.active;
  return (
    <span
      className={['lm-escrow', className].filter(Boolean).join(' ')}
      style={{ color: s.fg, background: s.bg }}
      {...rest}
    >
      {showIcon ? <Icon name={s.icon} size={13} /> : <span className="lm-escrow__dot" />}
      {label || s.label}
    </span>
  );
}
