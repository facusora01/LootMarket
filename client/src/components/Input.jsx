import { Icon } from './Icon.jsx';

export function Input({ label, icon, error, help, invalid = false, id, className = '', ...rest }) {
  const inputId = id || (label ? `lm-in-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);
  const isInvalid = invalid || !!error;
  const input = (
    <input
      id={inputId}
      className={['lm-input', isInvalid ? 'lm-input--invalid' : '', className].filter(Boolean).join(' ')}
      {...rest}
    />
  );
  return (
    <div className="lm-field">
      {label && <label className="lm-label" htmlFor={inputId}>{label}</label>}
      {icon ? (
        <span className="lm-input-wrap">
          <span className="lm-input-wrap__icon"><Icon name={icon} size={16} /></span>
          {input}
        </span>
      ) : input}
      {error ? <span className="lm-help lm-help--error">{error}</span>
        : help ? <span className="lm-help">{help}</span> : null}
    </div>
  );
}
