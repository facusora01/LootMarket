import { useEffect, useRef } from 'react';

/**
 * Fondo interactivo de polka dots sobre canvas.
 * Los puntos cerca del cursor se agrandan, se iluminan y se apartan suavemente.
 * Render en requestAnimationFrame con lerp para que el movimiento sea fluido.
 */
export default function DotGrid({
  gap = 24,          // separación entre puntos (px) — ~2× la densidad anterior
  radius = 1.5,      // radio base del punto (px)
  influence = 100,   // radio de influencia del mouse (px)
  push = 5,          // desplazamiento máximo al apartarse del cursor (px)
  maxScale = 1.7,    // escala máxima del punto bajo el cursor
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let dots = [];
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0, height = 0;
    let raf = 0;

    // Cursor: target = posición real; pos = posición suavizada que persigue al target.
    const mouse = { x: -9999, y: -9999, tx: -9999, ty: -9999, active: false };

    // Color del punto leído de la design-token (con fallback).
    const css = getComputedStyle(document.documentElement);
    const baseColor = (css.getPropertyValue('--indigo-400').trim() || '#8b9cff');

    function build() {
      const rect = canvas.getBoundingClientRect();
      width = rect.width; height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      dots = [];
      const cols = Math.ceil(width / gap) + 1;
      const rows = Math.ceil(height / gap) + 1;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          dots.push({ x: c * gap, y: r * gap });
        }
      }
    }

    function hexToRgb(hex) {
      const h = hex.replace('#', '');
      const n = h.length === 3 ? h.split('').map((x) => x + x).join('') : h;
      const int = parseInt(n, 16);
      return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
    }
    const [cr, cg, cb] = hexToRgb(baseColor);

    function frame() {
      // Suavizado del cursor.
      mouse.x += (mouse.tx - mouse.x) * 0.1;
      mouse.y += (mouse.ty - mouse.y) * 0.1;

      ctx.clearRect(0, 0, width, height);

      const inf2 = influence * influence;
      for (let i = 0; i < dots.length; i++) {
        const d = dots[i];
        let dx = d.x - mouse.x;
        let dy = d.y - mouse.y;
        const dist2 = dx * dx + dy * dy;

        let scale = 1;
        let ox = 0, oy = 0;
        let alpha = 0.14;

        if (mouse.active && dist2 < inf2) {
          const dist = Math.sqrt(dist2) || 0.0001;
          const t = 1 - dist / influence;      // 0 en el borde, 1 en el centro
          const ease = t * t;                  // caída suave
          scale = 1 + (maxScale - 1) * ease;
          alpha = 0.14 + 0.20 * ease;
          const force = push * ease;
          ox = (dx / dist) * force;
          oy = (dy / dist) * force;
        }

        ctx.beginPath();
        ctx.arc(d.x + ox, d.y + oy, radius * scale, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${cr},${cg},${cb},${alpha})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    }

    function onMove(e) {
      const rect = canvas.getBoundingClientRect();
      mouse.tx = e.clientX - rect.left;
      mouse.ty = e.clientY - rect.top;
      if (!mouse.active) { mouse.x = mouse.tx; mouse.y = mouse.ty; }
      mouse.active = true;
    }
    function onLeave() { mouse.active = false; mouse.tx = -9999; mouse.ty = -9999; }

    build();
    raf = requestAnimationFrame(frame);
    window.addEventListener('resize', build);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerdown', onMove);
    document.addEventListener('mouseleave', onLeave);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', build);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onMove);
      document.removeEventListener('mouseleave', onLeave);
    };
  }, [gap, radius, influence, push, maxScale]);

  return <canvas ref={canvasRef} className="lmk-dotgrid" aria-hidden="true" />;
}
