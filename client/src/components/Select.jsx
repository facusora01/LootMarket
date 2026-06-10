export function Select({ label, error, help, id, children, className = '', ...rest }) {
  const selId = id || (label ? `lm-sel-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);
  return (
    <div className="lm-field">
      {label && <label className="lm-label" htmlFor={selId}>{label}</label>}
      <select id={selId} className={['lm-select', className].filter(Boolean).join(' ')} {...rest}>
        {children}
      </select>
      {error ? <span className="lm-help lm-help--error">{error}</span>
        : help ? <span className="lm-help">{help}</span> : null}
    </div>
  );
}
