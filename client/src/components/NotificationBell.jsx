import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { Icon } from './Icon.jsx';

const KIND_ICON = {
  sale: 'circle-dollar-sign',
  purchase: 'shopping-cart',
  transfer: 'send',
  release: 'badge-check',
  dispute_opened: 'gavel',
  dispute_resolved: 'gavel',
};

function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'recién';
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  return `hace ${Math.floor(s / 86400)} d`;
}

export function NotificationBell() {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  const navigate = useNavigate();

  const load = () => api('/notifications')
    .then((r) => { setItems(r.items || []); setUnread(r.unread || 0); })
    .catch(() => {});

  // Carga inicial + polling cada 30s.
  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  // Cerrar al clickear afuera.
  useEffect(() => {
    function onClick(e) { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); }
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, []);

  async function openItem(n) {
    setOpen(false);
    if (!n.read) {
      try { await api(`/notifications/${n.id}/read`, { method: 'POST', body: {} }); } catch { /* noop */ }
      load();
    }
    if (n.link) navigate(n.link);
  }

  async function markAll() {
    try { await api('/notifications/read-all', { method: 'POST', body: {} }); } catch { /* noop */ }
    load();
  }

  return (
    <div className="lmk-bell" ref={boxRef}>
      <button className="lmk-iconbtn lmk-bell__btn" onClick={() => setOpen((o) => !o)} title="Notificaciones" aria-label="Notificaciones">
        <Icon name="bell" size={18} />
        {unread > 0 && <span className="lmk-bell__badge">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="lmk-bell__panel">
          <div className="lmk-bell__head">
            <span>Notificaciones</span>
            {unread > 0 && <button onClick={markAll}>Marcar todas</button>}
          </div>
          {items.length > 0 ? (
            <div className="lmk-bell__list">
              {items.map((n) => (
                <button
                  key={n.id}
                  className={'lmk-bell__item' + (n.read ? '' : ' is-unread')}
                  onClick={() => openItem(n)}
                >
                  <Icon name={KIND_ICON[n.kind] || 'bell'} size={16} />
                  <span className="lmk-bell__msg">{n.message}</span>
                  <span className="lmk-bell__time">{timeAgo(n.created_at)}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="lmk-bell__empty">Sin notificaciones.</div>
          )}
        </div>
      )}
    </div>
  );
}
