export function Textarea({ label, error, help, invalid = false, id, rows = 3, className = '', ...rest }) {
  const taId = id || (label ? `lm-ta-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);
  const isInvalid = invalid || !!error;
  return (
    <div className="lm-field">
      {label && <label className="lm-label" htmlFor={taId}>{label}</label>}
      <textarea
        id={taId}
        rows={rows}
        className={['lm-textarea', isInvalid ? 'lm-textarea--invalid' : '', className].filter(Boolean).join(' ')}
        {...rest}
      />
      {error ? <span className="lm-help lm-help--error">{error}</span>
        : help ? <span className="lm-help">{help}</span> : null}
    </div>
  );
}
