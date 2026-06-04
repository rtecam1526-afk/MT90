// Modo recorrer cartera uno a uno
const { useState: useStateK } = React;

function CarteraRecorrer({ queue, done, onToggleDone, onWhatsapp, onSalir }) {
  const [idx, setIdx] = useStateK(0);

  if (!queue || queue.length === 0) {
    return (
      <div className="focus-wrap fade-in">
        <button className="cola-back" onClick={onSalir}><Icon.back /> Volver a Cartera</button>
        <p style={{ textAlign:"center", color:"var(--muted)", marginTop:40 }}>No hay contactos.</p>
      </div>
    );
  }

  const total = queue.length;
  const i = Math.min(idx, total - 1);
  const p = queue[i];
  const pct = Math.round((i / total) * 100);
  const hecho = !!(done && done[p.id]);
  const urgente = p.dias != null && p.dias > 120;

  return (
    <div className="focus-wrap fade-in">
      <button className="cola-back" onClick={onSalir}><Icon.back /> Volver a Cartera</button>

      <div className="focus-progress">
        <span className="label">{i + 1} de {total}</span>
        <div className="track"><div className="fill" style={{ width: pct + "%" }}></div></div>
        <span className="label">{total - i - 1} restantes</span>
      </div>

      <div className="focus-card">
        <Avatar iniciales={p.iniciales} />
        <h2 className="fc-name">{p.nombre}</h2>
        <p className="fc-meta">
          <StageTag etapa={p.etapa} />
          {p.dias != null && (
            <span style={{ color: urgente ? "var(--caliente)" : "var(--muted)", marginLeft:8 }}>
              {tiempoSinHablar(p.dias)}
            </span>
          )}
        </p>
        {(p.nota || p.necesidad) && (
          <div className="fc-context">
            <span className="chip">{p.nota || p.necesidad}</span>
          </div>
        )}
        {p.mensaje && (
          <div className="fc-block">
            <div className="blabel"><Icon.wa /> Mensaje sugerido</div>
            <div className="fc-msg">{p.mensaje}</div>
          </div>
        )}
        <div className="fc-cta">
          <button className="btn btn-wa" onClick={() => onWhatsapp && onWhatsapp(p)}>
            <Icon.wa /> Abrir en WhatsApp
          </button>
        </div>
        <button className={"btn btn-done" + (hecho ? " is-done" : "")}
                style={{ width:"100%", marginTop:"4px" }}
                onClick={() => onToggleDone && onToggleDone(p.id)}>
          <Icon.check /> {hecho ? "Ya hable hoy" : "Marcar como hablado"}
        </button>
        <div className="fc-next">
          {i > 0 && (
            <button className="btn-back-lg" onClick={() => setIdx(i - 1)}>
              <Icon.back /> Anterior
            </button>
          )}
          {i < total - 1 ? (
            <button className="btn-primary-lg" onClick={() => setIdx(i + 1)}>
              Siguiente <Icon.arrow />
            </button>
          ) : (
            <button className="btn-primary-lg" onClick={onSalir}>
              <Icon.check /> Listo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { CarteraRecorrer });
