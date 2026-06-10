export function Switch({ checked = false, onChange, disabled = false, label, id, className = '' }) {
  const cls = ['lm-switch', checked ? 'lm-switch--on' : '', disabled ? 'lm-switch--disabled' : '', className]
    .filter(Boolean).join(' ');
  function toggle() { if (!disabled && onChange) onChange(!checked); }
  return (
    <label className={cls} htmlFor={id}>
      <button
        type="button" role="switch" aria-checked={checked} id={id}
        className="lm-switch__track" onClick={toggle} disabled={disabled}
        style={{ border: 0, padding: 0, cursor: disabled ? 'not-allowed' : 'pointer' }}
      >
        <span className="lm-switch__thumb" />
      </button>
      {label && <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-body)' }}>{label}</span>}
    </label>
  );
}
