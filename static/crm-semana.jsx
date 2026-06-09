// "Mi semana" — el entregable del servicio de seguimiento semanal, hecho pantalla.
// Cálido, tipo informe del asistente. Loaded after views.jsx.
const { useState: useStateS } = React;

function MiSemana({ data, done, onWhatsapp, onToggleDone, onOpen, onIrHoy, onRevision }) {
  const sem = data.semana;
  const total = data.hoy.length;
  const hechos = data.hoy.filter((p) => done[p.id]).length;
  const pct = total ? Math.round((hechos / total) * 100) : 0;
  const lunes = lunesDeEstaSemana();

  const byId = {};
  data.hoy.forEach((p) => { byId[p.id] = p; });

  const cumples = data.hoy.filter((p) => esCumpleHoy(p.cumple));
  const enfriando = (sem.enfriando || []).map((id) => byId[id]).filter(Boolean);
  const oportunidades = sem.oportunidades.map((o) => ({ ...o, contacto: byId[o.id] }));

  return (
    <div className="semana fade-in">
      {/* Report header */}
      <div className="sem-report">
        <div className="sem-report-head">
          <Icon.spark />
          <span>Tu seguimiento semanal · preparado por {sem.servicio}</span>
        </div>
        <h1 className="sem-title">Mi semana</h1>
        <p className="sem-lead">
          Revisé tus <b>{sem.revisados} contactos</b> uno por uno y armé tu plan.
          Actualizado el <b>{fechaLarga(lunes)}</b>.
        </p>

        <div className="sem-progress">
          <div className="sem-progress-row">
            <span>Avance de la semana</span>
            <span><b>{hechos}</b> de {total} contactados</span>
          </div>
          <div className="sem-track"><div className="sem-fill" style={{ width: pct + "%" }}></div></div>
        </div>
      </div>

      {/* Revisión 1-a-1 con el asesor */}
      <div className="rev-launch">
        <div className="rev-launch-ic"><Icon.users /></div>
        <div className="rev-launch-tx">
          <b>Revisá tu cartera con tu asesor</b>
          <small>Repasamos contacto por contacto y dejamos las próximas acciones anotadas.</small>
        </div>
        <button className="rev-launch-btn" onClick={onRevision}>Empezar revisión <Icon.arrow /></button>
      </div>

      {/* Próximas acciones */}
      {sem.conAccion && sem.conAccion.length > 0 && (
        <section className="sem-section">
          <div className="sem-sec-head">
            <h2><span className="sem-num" style={{ background: "var(--primary)" }}>{sem.conAccion.length}</span> Con acción pendiente</h2>
          </div>
          <div className="sem-rows">
            {sem.conAccion.map((p) => (
              <div className={"sem-row" + (done[p.id] ? " is-done" : "")} key={p.id} onClick={() => onOpen(p)}>
                <Avatar iniciales={p.iniciales} />
                <div className="sem-row-id">
                  <div className="sem-row-name">{p.nombre} {done[p.id] && <span className="sem-tick"><Icon.check /> hablado</span>}</div>
                  <div className="sem-row-need" style={{ color: "var(--primary)", fontWeight: 600 }}>
                    → {p.proximaAccion}
                    {p.proximaFechaAccion && (
                      <span style={{ fontWeight: 400, color: "var(--muted)", marginLeft: 6 }}>
                        · {formatoCumple(p.proximaFechaAccion)}
                      </span>
                    )}
                  </div>
                </div>
                <StageTag etapa={p.etapa} />
                <button className="sem-wa" onClick={(e) => { e.stopPropagation(); onWhatsapp(esCumpleHoy(p.cumple) ? { ...p, mensaje: mensajeCumple(p.nombre) } : p); }} aria-label="WhatsApp">
                  <Icon.wa />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Para contactar */}
      <section className="sem-section">
        <div className="sem-sec-head">
          <h2><span className="sem-num" style={{ background: "var(--primary)" }}>{total - hechos}</span> Para contactar esta semana</h2>
          <button className="sem-link" onClick={onIrHoy}>Verlas una por una <Icon.arrow /></button>
        </div>
        <div className="sem-rows">
          {data.hoy.map((p) => (
            <div className={"sem-row" + (done[p.id] ? " is-done" : "")} key={p.id} onClick={() => onOpen(p)}>
              <Avatar iniciales={p.iniciales} />
              <div className="sem-row-id">
                <div className="sem-row-name">{p.nombre} {done[p.id] && <span className="sem-tick"><Icon.check /> hablado</span>}</div>
                <div className="sem-row-need">
                  {p.proximaAccion
                    ? <span style={{ color: "var(--primary)", fontWeight: 600 }}>
                        → {p.proximaAccion}
                        {p.proximaFechaAccion && (
                          <span style={{ fontWeight: 400, color: "var(--muted)", marginLeft: 6 }}>
                            · {formatoCumple(p.proximaFechaAccion)}
                          </span>
                        )}
                      </span>
                    : p.necesidad}
                </div>
              </div>
              <StageTag etapa={p.etapa} />
              <button className="sem-wa" onClick={(e) => { e.stopPropagation(); onWhatsapp(esCumpleHoy(p.cumple) ? { ...p, mensaje: mensajeCumple(p.nombre) } : p); }} aria-label="WhatsApp">
                <Icon.wa />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Oportunidades detectadas */}
      <section className="sem-section">
        <div className="sem-sec-head">
          <h2><span className="sem-emoji"><Icon.idea /></span> Oportunidades que vi</h2>
        </div>
        <div className="sem-opps">
          {oportunidades.map((o) => (
            <div className="sem-opp" key={o.id} onClick={() => o.contacto && onOpen(o.contacto)}>
              <div className="sem-opp-ic">{Icon[o.icono] ? Icon[o.icono]() : null}</div>
              <div>
                <div className="sem-opp-title">{o.titulo}</div>
                <div className="sem-opp-detail">{o.detalle}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="sem-two">
        {/* Se están enfriando */}
        <section className="sem-section">
          <div className="sem-sec-head">
            <h2><span className="sem-emoji"><Icon.cooling /></span> Se están enfriando</h2>
          </div>
          <div className="sem-rows compact">
            {enfriando.map((p) => (
              <div className="sem-row" key={p.id} onClick={() => onOpen(p)}>
                <Avatar iniciales={p.iniciales} />
                <div className="sem-row-id">
                  <div className="sem-row-name">{p.nombre}</div>
                  <div className="sem-row-need warn">{tiempoSinHablar(p.diasSinContacto)}</div>
                </div>
                <button className="sem-wa" onClick={(e) => { e.stopPropagation(); onWhatsapp(p); }} aria-label="WhatsApp">
                  <Icon.wa />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Cumpleaños */}
        <section className="sem-section">
          <div className="sem-sec-head">
            <h2><span className="sem-emoji"><Icon.gift /></span> Cumpleaños</h2>
          </div>
          <div className="sem-rows compact">
            {cumples.length === 0 && <div className="sem-empty">Sin cumpleaños esta semana.</div>}
            {cumples.map((p) => (
              <div className="sem-row" key={p.id} onClick={() => onOpen(p)}>
                <Avatar iniciales={p.iniciales} />
                <div className="sem-row-id">
                  <div className="sem-row-name">{p.nombre}</div>
                  <div className="sem-row-need" style={{ color: "#C2553D", fontWeight: 600 }}>Hoy, {formatoCumple(p.cumple)}</div>
                </div>
                <button className="sem-wa" onClick={(e) => { e.stopPropagation(); onWhatsapp({ ...p, mensaje: mensajeCumple(p.nombre) }); }} aria-label="Saludar">
                  <Icon.wa />
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Signature / close */}
      <div className="sem-signoff">
        <span className="sig-spark"><Icon.spark /></span>
        {hechos >= total
          ? <p>Cerraste la semana completa. <b>¡Te felicito!</b> El lunes te dejo la próxima tanda revisada.</p>
          : <p>Seguí así, <b>{data.agente}</b>. Yo me encargo de revisar tu cartera; vos enfocate en hablar con la gente.</p>}
      </div>
    </div>
  );
}

window.MiSemana = MiSemana;

/* ============================================================
   CIERRE DE SEMANA — resumen celebratorio de los viernes.
   Aparece arriba de "Hoy" (viernes o lista completa). Refuerza
   el hábito y la sensación de acompañamiento del servicio.
   ============================================================ */
function CierreSemana({ data, onVerSemana, onClose }) {
  const c = data.semana.cierre;
  const pct = Math.round((c.hablados / c.objetivo) * 100);
  const lleno = c.hablados >= c.objetivo;
  const primer = data.agente;

  return (
    <div className="cierre fade-in">
      <button className="cierre-x" onClick={onClose} aria-label="Cerrar"><Icon.x /></button>
      <div className="cierre-head">
        <span className="cierre-emoji"><Icon.spark /></span>
        <div className="cierre-kicker">Cierre de semana · viernes</div>
      </div>
      <h2 className="cierre-title">
        {lleno
          ? <>¡Semana redonda, {primer}!</>
          : <>Buena semana, {primer}.</>}
      </h2>
      <p className="cierre-lead">
        Hablaste con <b>{c.hablados} de {c.objetivo}</b> personas que te preparé.
        {lleno ? " Cumpliste el objetivo." : " Te quedaste cerca — el lunes lo retomamos."}
      </p>

      <div className="cierre-track"><div className="cierre-fill" style={{ width: pct + "%" }}></div></div>

      <div className="cierre-stats">
        <div className="cstat"><div className="cn">{c.hablados}</div><div className="cl">Contactados</div></div>
        <div className="cstat"><div className="cn">{c.nuevos}</div><div className="cl">Nuevos cargados</div></div>
        <div className="cstat"><div className="cn">{c.reuniones}</div><div className="cl">Reuniones</div></div>
        <div className="cstat racha"><div className="cn"><span className="cn-ic"><Icon.flame /></span>{c.racha}</div><div className="cl">Semanas en racha</div></div>
      </div>

      <div className="cierre-foot">
        <p>El lunes vuelvo a revisar tus {data.semana.revisados} contactos y te dejo la próxima tanda lista.</p>
        <button className="cierre-cta" onClick={onVerSemana}>Ver mi semana <Icon.arrow /></button>
      </div>
    </div>
  );
}

window.CierreSemana = CierreSemana;