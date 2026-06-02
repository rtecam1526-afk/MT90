// REVISIÓN GUIADA 1-a-1 — el momento humano del servicio.
// Pantalla completa para repasar contacto por contacto con tu asesor de
// Tracción: ver la situación, tomar nota, definir próximo paso y etapa.
const { useState: useStateR, useEffect: useEffectR } = React;

function RevisionGuiada({ data, onCerrar }) {
  // Build the review set from the prepared weekly queue.
  const set = data.hoy;
  const [idx, setIdx] = useStateR(0);
  const [registro, setRegistro] = useStateR({}); // id -> { nota, accion, etapa }
  const [fin, setFin] = useStateR(false);

  const p = set[idx];
  const actual = registro[p.id] || { nota: "", accion: p.proximaAccion || "", etapa: p.etapa };
  const total = set.length;
  const revisados = Object.keys(registro).length;
  const stageOrder = ["caliente", "media", "fria", "sin"];

  function update(patch) {
    setRegistro((r) => ({ ...r, [p.id]: { ...actual, ...patch } }));
  }
  function avanzar() {
    setRegistro((r) => ({ ...r, [p.id]: { ...actual } }));
    // Save to API
    if (p.id && window.CRM_API) {
      const EMAP = {caliente:'Caliente',media:'Media',fria:'Fria',sin:'Sin Etapa'};
      if (actual.accion !== (p.proximaAccion || '')) window.CRM_API.put('/contactos/'+p.id, {proxima_accion: actual.accion}).catch(console.error);
      if (actual.etapa !== p.etapa) window.CRM_API.put('/contactos/'+p.id, {etapa: EMAP[actual.etapa] || 'Sin Etapa'}).catch(console.error);
    }
    if (idx < total - 1) setIdx(idx + 1);
    else setFin(true);
  }
  function atras() { if (idx > 0) setIdx(idx - 1); }

  useEffectR(() => {
    function onKey(e) { if (e.key === "Escape") onCerrar(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="rev-overlay">
      <div className="rev-top">
        <div className="rev-top-id">
          <span className="rev-orb"><Icon.spark /></span>
          <div>
            <div className="rev-title">Revisión con tu asesor</div>
            <div className="rev-sub">Repasamos tu cartera juntos, contacto por contacto</div>
          </div>
        </div>
        <button className="rev-close" onClick={onCerrar} aria-label="Cerrar"><Icon.x /></button>
      </div>

      <div className="rev-progress-bar"><div className="rev-progress-fill" style={{ width: ((fin ? total : idx) / total * 100) + "%" }}></div></div>

      <div className="rev-body">
        {fin ? (
          <div className="rev-done">
            <h2>Revisión terminada</h2>
            <p>Repasaron <b>{Math.max(revisados, total)} contactos</b> y dejaron las próximas acciones anotadas. Yo me encargo de recordártelas en “Hoy” durante la semana.</p>
            <div className="rev-recap">
              {set.map((c) => {
                const reg = registro[c.id] || { accion: c.proximaAccion, etapa: c.etapa };
                return (
                  <div className="rev-recap-row" key={c.id}>
                    <Avatar iniciales={c.iniciales} />
                    <div className="rev-recap-id">
                      <div className="rev-recap-name">{c.nombre}</div>
                      <div className="rev-recap-act">{reg.accion || "—"}</div>
                    </div>
                    <StageTag etapa={reg.etapa || c.etapa} />
                  </div>
                );
              })}
            </div>
            <button className="btn-primary-lg" style={{ maxWidth: 320, margin: "4px auto 0" }} onClick={onCerrar}>Cerrar revisión</button>
          </div>
        ) : (
          <div className="rev-card" key={p.id}>
            <div className="rev-count">Contacto {idx + 1} de {total}</div>
            <div className="rev-person">
              <Avatar iniciales={p.iniciales} />
              <div className="rev-person-id">
                <div className="rev-person-name">{p.nombre}</div>
                <div className="rev-person-need">{p.necesidad}</div>
              </div>
              <span className="rev-time">{tiempoSinHablar(p.diasSinContacto)}</span>
            </div>

            <div className="rev-context">
              <span className="rev-ctx-label">Última nota</span>
              <p>{p.proximaAccion}</p>
            </div>

            <div className="rev-field">
              <label>¿Qué pasó? ¿Qué decidimos?</label>
              <textarea
                value={actual.nota}
                onChange={(e) => update({ nota: e.target.value })}
                placeholder="Anotá lo que hablaron con tu asesor…"
                rows="3"
              />
            </div>

            <div className="rev-field">
              <label>Próxima acción</label>
              <input value={actual.accion} onChange={(e) => update({ accion: e.target.value })} placeholder="Qué hacer con esta persona" />
            </div>

            <div className="rev-field">
              <label>Etapa</label>
              <div className="dstage-picker">
                {stageOrder.map((k) => {
                  const s = STAGE[k];
                  const active = (actual.etapa || p.etapa) === k;
                  return (
                    <button type="button" key={k} className={"dstage-opt" + (active ? " active" : "")}
                      style={active ? { borderColor: s.color, background: s.soft, color: s.color } : null}
                      onClick={() => update({ etapa: k })}>
                      <span className="dot" style={{ background: s.color }}></span>{s.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {!fin && (
        <div className="rev-foot">
          {idx > 0 && <button className="rev-prev" onClick={atras}><Icon.back /> Anterior</button>}
          <button className="rev-next" onClick={avanzar}>
            {idx < total - 1 ? <>Guardar y seguir <Icon.arrow /></> : <>Terminar revisión <Icon.check /></>}
          </button>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { RevisionGuiada });

