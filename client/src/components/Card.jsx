export function Card({ children, raised = false, interactive = false, as: Tag = 'div', className = '', ...rest }) {
  const cls = ['lm-card', raised ? 'lm-card--raised' : '', interactive ? 'lm-card--interactive' : '', className]
    .filter(Boolean).join(' ');
  return <Tag className={cls} {...rest}>{children}</Tag>;
}
