// Secondary CRM functions — kept out of the way, reachable in one tap.
// Buscador global · Menú "Más" (Sincronizar, Agente IA, Ajustes).
const { useState: useStateE, useEffect: useEffectE, useRef: useRefE } = React;

/* ---------- Buscador global ---------- */
function flattenContactos(data) {
  const out = [];
  const seen = {};
  data.hoy.forEach((p) => { out.push({ ...p, _origen: "Hoy" }); seen[p.nombre] = true; });
  Object.entries(data.cartera).forEach(([etapa, arr]) => {
    arr.forEach((it) => out.push({ ...it, etapa, necesidad: it.nota, _origen: "Cartera" }));
  });
  return out;
}

function BuscarOverlay({ data, onOpen, onClose }) {
  const [q, setQ] = useStateE("");
  const todos = React.useMemo(() => flattenContactos(data), [data]);
  const res = q.trim()
    ? todos.filter((c) => (c.nombre || "").toLowerCase().includes(q.toLowerCase()) || (c.necesidad || "").toLowerCase().includes(q.toLowerCase())).slice(0, 8)
    : todos.slice(0, 6);

  useEffectE(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="search-backdrop" onClick={onClose}>
      <div className="search-box" onClick={(e) => e.stopPropagation()}>
        <div className="search-input-row">
          <Icon.search />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar un contacto por nombre o necesidad…" />
          <kbd>Esc</kbd>
        </div>
        <div className="search-results">
          {!q.trim() && <div className="search-hint-row">Empezá a escribir, o elegí uno reciente</div>}
          {res.length === 0 && <div className="search-empty">No encontré a nadie con “{q}”.</div>}
          {res.map((c) => (
            <button className="search-item" key={(c.id || c.nombre) + c._origen} onClick={() => { onClose(); onOpen(c); }}>
              <Avatar iniciales={c.iniciales} />
              <div className="si-id">
                <div className="si-name">{c.nombre}</div>
                <div className="si-need">{c.necesidad || "—"}</div>
              </div>
              <StageTag etapa={c.etapa} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- Menú "Más" ---------- */
function MenuMas({ lastSync, onSync, onIA, onAjustes, onClose }) {
  const ref = useRefE(null);
  useEffectE(() => {
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) onClose(); }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div className="menu-mas" ref={ref}>
      <button className="mm-item" onClick={() => { onClose(); onSync(); }}>
        <span className="mm-ic"><Icon.sync /></span>
        <span className="mm-tx"><b>Sincronizar</b><small>{lastSync}</small></span>
      </button>
      <button className="mm-item" onClick={() => { onClose(); onIA(); }}>
        <span className="mm-ic ia"><Icon.spark /></span>
        <span className="mm-tx"><b>Agente IA</b><small>Redacta tus mensajes</small></span>
      </button>
      <div className="mm-divider"></div>
      <button className="mm-item" onClick={() => { onClose(); onAjustes(); }}>
        <span className="mm-ic"><Icon.gear /></span>
        <span className="mm-tx"><b>Ajustes</b><small>Cuenta y preferencias</small></span>
      </button>
    </div>
  );
}

/* ---------- Agente IA (panel) ---------- */
function AgenteIAPanel({ onClose }) {
  useEffectE(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal ia-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ia-head">
          <span className="ia-orb"><Icon.spark /></span>
          <div>
            <div className="m-kicker">Agente IA</div>
            <h2>Yo redacto, vos enviás</h2>
          </div>
        </div>
        <p className="ia-lead">Cada persona de tu lista ya viene con un mensaje sugerido, escrito según su situación. Vos solo lo revisás y enviás por WhatsApp.</p>
        <div className="ia-feats">
          <div className="ia-feat"><span><Icon.pencil /></span><div className="ia-feat-tx"><b>Mensajes a medida</b><small>Tono cálido, adaptado a cada cliente.</small></div></div>
          <div className="ia-feat"><span><Icon.gift /></span><div className="ia-feat-tx"><b>Saludos automáticos</b><small>Cumpleaños y fechas clave, listos.</small></div></div>
          <div className="ia-feat"><span><Icon.cooling /></span><div className="ia-feat-tx"><b>Detecta enfriamientos</b><small>Te avisa a quién estás por perder.</small></div></div>
        </div>
        <div className="ia-toggle-row">
          <div><b>Sugerir mensajes siempre</b><small>Activado</small></div>
          <span className="ia-switch on"><span></span></span>
        </div>
        <div className="modal-actions">
          <button className="save" onClick={onClose}>Entendido</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Ajustes (modal) ---------- */
function AjustesModal({ data, onClose }) {
  useEffectE(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="m-kicker">MT90 Tracción</div>
        <h2>Ajustes</h2>

        <div className="aj-profile">
          <Avatar iniciales="GA" />
          <div>
            <div className="aj-name">{data.agente} · JRC</div>
            <div className="aj-sub">{data.totalContactos} contactos · plan Agente</div>
          </div>
        </div>

        <div className="aj-list">
          <div className="aj-row"><span>Cuántos contactos por día</span><select defaultValue="7"><option>5</option><option>7</option><option>10</option><option>15</option></select></div>
          <div className="aj-row"><span>Recordatorio diario</span><span className="ia-switch on"><span></span></span></div>
          <div className="aj-row"><span>Avisar cumpleaños</span><span className="ia-switch on"><span></span></span></div>
          <div className="aj-row"><span>País / WhatsApp</span><select defaultValue="ar"><option value="ar">Argentina (+54)</option><option>Uruguay (+598)</option><option>Chile (+56)</option></select></div>
        </div>
        <p className="aj-tip">¿Querés cambiar colores, tipografía o el tamaño del texto? Está en el panel <b>Tweaks</b>.</p>

        <div className="modal-actions">
          <button className="save" onClick={onClose}>Guardar</button>
          <button className="cancel" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { BuscarOverlay, MenuMas, AgenteIAPanel, AjustesModal });
