import { useEffect, useRef } from 'react';

export function Icon({ name, size = 20, strokeWidth = 2, color = 'currentColor', className = '', style = {} }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof window === 'undefined' || !window.lucide) return;
    el.innerHTML = '';
    const i = document.createElement('i');
    i.setAttribute('data-lucide', name);
    el.appendChild(i);
    window.lucide.createIcons({
      attrs: { width: size, height: size, 'stroke-width': strokeWidth },
      nameAttr: 'data-lucide',
    });
  }, [name, size, strokeWidth]);

  return (
    <span
      ref={ref}
      className={className}
      style={{ display: 'inline-flex', color, lineHeight: 0, ...style }}
      aria-hidden="true"
    />
  );
}
