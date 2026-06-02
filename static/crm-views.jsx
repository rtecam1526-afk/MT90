// Views for the redesign. Loaded after components.jsx.
const { useState: useStateV, useEffect: useEffectV, useRef: useRefV } = React;

/* ============================================================
   VISTA HOY â€” LISTA DEL DÃA
   Clean vertical list of "who to talk to today". WhatsApp-first,
   one tap to mark "Ya hablÃ©". No filters, no jargon.
   ============================================================ */
function HoyLista({ data, done, onToggleDone, onWhatsapp, onOpen }) {
  const total = data.hoy.length;
  const hechos = data.hoy.filter((p) => done[p.id]).length;
  const pct = total ? Math.round((hechos / total) * 100) : 0;
  const pendientes = data.hoy.filter((p) => !done[p.id]);
  const completados = data.hoy.filter((p) => done[p.id]);
  // Birthday people first among pending â€” a warm, concrete reason to reach out.
  const ordenarPend = [...pendientes].sort((a, b) => (esCumpleHoy(b.cumple) ? 1 : 0) - (esCumpleHoy(a.cumple) ? 1 : 0));
  const ordenados = [...ordenarPend, ...completados];
  const cumpleHoy = data.hoy.filter((p) => esCumpleHoy(p.cumple) && !done[p.id]);

  return (
    <div className="fade-in">
      <div className="greeting">
        <div className="prep-chip">
          <Icon.spark /> Preparado por {data.semana.servicio} Â· {fechaCorta(lunesDeEstaSemana())}
        </div>
        <h1 className="hello">Buenos dÃ­as, <span className="accent">{data.agente}</span></h1>
        <p className="sub">
          {hechos < total
            ? <>Esta semana revisÃ© tus <b>{data.semana.revisados} contactos</b> y te separÃ© <b>{total - hechos}</b> para saludar. EmpezÃ¡ por arriba.</>
            : <>Â¡Hablaste con todos los que te preparÃ©! Tu semana estÃ¡ al dÃ­a.</>}
        </p>
      </div>

      {cumpleHoy.length > 0 && (
        <div className="bday-banner" onClick={() => onWhatsapp({ ...cumpleHoy[0], mensaje: mensajeCumple(cumpleHoy[0].nombre) })}>
          <span className="cake"><Icon.gift /></span>
          <div className="bday-text">
            <b>Hoy cumple {cumpleHoy[0].nombre.split(" ")[0]}{cumpleHoy.length > 1 ? ` y ${cumpleHoy.length - 1} mÃ¡s` : ""}.</b>
            <span> Buena excusa para saludar y mantener el vÃ­nculo cÃ¡lido.</span>
          </div>
          <span className="bday-go">Saludar <Icon.arrow /></span>
        </div>
      )}

      <div className="day-bar">
        <span className="count"><b>{hechos}</b> de {total} contactados</span>
        <div className="track"><div className="fill" style={{ width: pct + "%" }}></div></div>
      </div>

      <div className="person-list">
        {ordenados.map((p) => (
          <PersonCard key={p.id} p={p} done={!!done[p.id]} onToggleDone={onToggleDone} onWhatsapp={onWhatsapp} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}

function PersonCard({ p, done, onToggleDone, onWhatsapp, onOpen }) {
  const urgente = esUrgente(p.diasSinContacto);
  const cumple = esCumpleHoy(p.cumple);
  return (
    <div className={"person-card" + (done ? " done" : "") + (cumple ? " is-bday" : "")}>
      {cumple && <div className="card-bday"><Icon.gift /> Hoy cumple aÃ±os</div>}
      <div className="pc-top tap" onClick={() => onOpen && onOpen(p)}>
        <Avatar iniciales={p.iniciales} />
        <div className="pc-id">
          <p className="pc-name">{p.nombre}</p>
          <p className="pc-need">{p.necesidad}</p>
        </div>
        <StageTag etapa={p.etapa} />
      </div>

      <div className="pc-action">
        <span className="label">Hacer:</span>
        <span>{cumple ? "Saludarlo por su cumpleaÃ±os" : p.proximaAccion}</span>
      </div>

      <div className="pc-meta">
        <span className={urgente ? "warn" : ""}>{tiempoSinHablar(p.diasSinContacto)}</span>
      </div>

      <div className="pc-actions">
        <button className="btn btn-wa" onClick={() => onWhatsapp(cumple ? { ...p, mensaje: mensajeCumple(p.nombre) } : p)}>
          <Icon.wa /> {cumple ? "Saludar" : "WhatsApp"}
        </button>
        <button className={"btn btn-done" + (done ? " is-done" : "")} onClick={() => onToggleDone(p.id)}>
          <Icon.check /> {done ? "Ya hablÃ©" : "Marcar como hablado"}
        </button>
        <button className="btn-ghost" onClick={() => onOpen && onOpen(p)}>Ver ficha</button>
      </div>
    </div>
  );
}

/* ============================================================
   VISTA HOY â€” MODO ENFOQUE
   One person at a time. Message already drafted. Zero decisions:
   WhatsApp â†’ "Listo, siguiente". Like a guided queue.
   ============================================================ */
function HoyEnfoque({ data, done, onToggleDone, onWhatsapp }) {
  const queue = data.hoy;
  const firstPending = queue.findIndex((p) => !done[p.id]);
  const [idx, setIdx] = useStateV(firstPending === -1 ? 0 : firstPending);
  const [toast, setToast] = useStateV(false);

  const total = queue.length;
  const hechos = queue.filter((p) => done[p.id]).length;
  const p = queue[idx];

  function flashToast(txt) {
    setToast(txt);
    setTimeout(() => setToast(false), 1600);
  }
  function avanzar() {
    if (!done[p.id]) onToggleDone(p.id);
    flashToast("Guardado");
    // go to next pending after this index
    let next = -1;
    for (let i = idx + 1; i < total; i++) { if (!done[queue[i].id]) { next = i; break; } }
    if (next === -1) for (let i = 0; i < total; i++) { if (!done[queue[i].id] && i !== idx) { next = i; break; } }
    setTimeout(() => { if (next !== -1) setIdx(next); }, 200);
  }

  if (hechos >= total) {
    return (
      <div className="focus-wrap fade-in">
        <div className="all-done">
          <div className="big"><Icon.check /></div>
          <h2>Â¡Listo por hoy!</h2>
          <p>Hablaste con las {total} personas de tu lista. MaÃ±ana te preparo la prÃ³xima tanda.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="focus-wrap fade-in">
      <div className="focus-progress">
        <span className="label">Persona {hechos + 1} de {total}</span>
        <div className="track"><div className="fill" style={{ width: ((hechos / total) * 100) + "%" }}></div></div>
        <span className="label">{total - hechos} por hablar</span>
      </div>

      <div className="focus-card" key={p.id}>
        <Avatar iniciales={p.iniciales} />
        <h2 className="fc-name">{p.nombre}</h2>
        <p className="fc-meta">{tiempoSinHablar(p.diasSinContacto)} Â· <StageTagInline etapa={p.etapa} /></p>

        <div className="fc-context">
          {p.contexto.map((c, i) => <span className="chip" key={i}>{c}</span>)}
        </div>

        <div className="fc-block">
          <div className="blabel"><Icon.target /> QuÃ© querÃ©s lograr</div>
          <div className="fc-action-text">{p.proximaAccion}</div>
        </div>

        <div className="fc-block">
          <div className="blabel"><Icon.wa /> Mensaje listo para enviar</div>
          <div className="fc-msg">{p.mensaje}</div>
        </div>

        <div className="fc-cta">
          <button className="btn btn-wa" onClick={() => onWhatsapp(p)}>
            <Icon.wa /> Abrir en WhatsApp
          </button>
        </div>

        <div className="fc-next">
          {hechos > 0 && (
            <button className="btn-back-lg" onClick={() => {
              for (let i = idx - 1; i >= 0; i--) { setIdx(i); return; }
              setIdx(Math.max(0, idx - 1));
            }}>
              <Icon.back /> Anterior
            </button>
          )}
          <button className="btn-primary-lg" onClick={avanzar}>
            Listo, siguiente <Icon.arrow />
          </button>
        </div>
      </div>

      <div className={"focus-toast" + (toast ? " show" : "")}>
        <Icon.check /> {toast || ""}
      </div>
    </div>
  );
}

function StageTagInline({ etapa }) {
  const s = STAGE[etapa] || STAGE.sin;
  return <span style={{ color: s.color, fontWeight: 700 }}>{s.label}</span>;
}

/* ============================================================
   INICIO ASISTENTE
   Warm home that tells you what to do and launches the queue.
   Maximum hand-holding for low-tech users.
   ============================================================ */
function InicioAsistente({ data, done, onEmpezar, onWhatsapp, onToggleDone, onOpen }) {
  const total = data.hoy.length;
  const hechos = data.hoy.filter((p) => done[p.id]).length;
  const calientes = data.hoy.filter((p) => p.etapa === "caliente").length;
  const urgentes = data.hoy.filter((p) => esUrgente(p.diasSinContacto)).length;
  const restantes = total - hechos;
  const cumpleHoy = data.hoy.filter((p) => esCumpleHoy(p.cumple) && !done[p.id]);

  return (
    <div className="fade-in">
      <div className="assistant-hero">
        <div className="spark"><Icon.spark /></div>
        <h1>
          {restantes > 0
            ? <>Hola {data.agente}. Esta semana te preparÃ© <span className="accent">{restantes} personas</span> para contactar.</>
            : <>Â¡BuenÃ­simo, {data.agente}! <span className="accent">Ya hablaste con todos</span> los de esta semana.</>}
        </h1>
        <p>
          {restantes > 0
            ? `RevisÃ© tus ${data.semana.revisados} contactos uno por uno, elegÃ­ a quiÃ©n conviene escribirle y te dejÃ© el mensaje listo. Vos solo tocÃ¡s \u201cEmpezar\u201d.`
            : "DisfrutÃ¡ el dÃ­a. El lunes vuelvo a revisar tu cartera y te armo la prÃ³xima tanda."}
        </p>
        {restantes > 0 && (
          <button className="assistant-cta" onClick={onEmpezar}>
            Empezar a contactar <Icon.arrow />
          </button>
        )}
      </div>

      <div className="assistant-stats">
        <div className="astat"><div className="n" style={{ color: "var(--caliente)" }}>{calientes}</div><div className="l">Clientes calientes</div></div>
        <div className="astat"><div className="n" style={{ color: "var(--primary)" }}>{restantes}</div><div className="l">Por contactar hoy</div></div>
        <div className="astat"><div className="n" style={{ color: "var(--media)" }}>{urgentes}</div><div className="l">Hace mucho sin hablar</div></div>
      </div>

      {cumpleHoy.length > 0 && (
        <div className="bday-banner" style={{ marginTop: "20px" }} onClick={() => onWhatsapp({ ...cumpleHoy[0], mensaje: mensajeCumple(cumpleHoy[0].nombre) })}>
          <span className="cake"><Icon.gift /></span>
          <div className="bday-text">
            <b>Hoy cumple {cumpleHoy[0].nombre.split(" ")[0]}.</b>
            <span> Un saludo a tiempo vale oro. Te dejo el mensaje listo.</span>
          </div>
          <span className="bday-go">Saludar <Icon.arrow /></span>
        </div>
      )}

      <div className="assistant-secondary">
        <p className="sec-title">Los primeros de la lista</p>
        <div className="list-rows">
          {data.hoy.slice(0, 3).map((p) => (
            <div className="lrow" key={p.id} onClick={() => onOpen && onOpen(p)}>
              <Avatar iniciales={p.iniciales} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="lr-name">{p.nombre}</div>
                <div className="lr-note">{p.necesidad}</div>
              </div>
              <button className="btn btn-wa" style={{ flex: "none", minWidth: 0, padding: "10px 16px" }} onClick={(e) => { e.stopPropagation(); onWhatsapp(p); }}>
                <Icon.wa /> Escribir
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   CARTERA â€” Kanban / Lista (vista secundaria, opcional)
   ============================================================ */
function Cartera({ data, onOpen }) {
  const [mode, setMode] = useStateV("kanban");
  const cols = [
    { key: "caliente", ...STAGE.caliente, items: data.cartera.caliente },
    { key: "media", label: "Media / Tibio", color: STAGE.media.color, items: data.cartera.media },
    { key: "fria", ...STAGE.fria, items: data.cartera.fria },
    { key: "sin", label: "Sin etapa", color: STAGE.sin.color, items: data.cartera.sin },
  ];
  const allRows = cols.flatMap((c) => c.items.map((it) => ({ ...it, etapa: c.key })));

  return (
    <div className="fade-in">
      <div className="cartera-head">
        <div>
          <h1>Tu cartera completa</h1>
          <p>{data.totalContactos} contactos Â· esto es opcional, tu dÃ­a ya estÃ¡ en â€œHoyâ€.</p>
        </div>
        <div className="view-toggle">
          <button className={mode === "kanban" ? "active" : ""} onClick={() => setMode("kanban")}>Tablero</button>
          <button className={mode === "lista" ? "active" : ""} onClick={() => setMode("lista")}>Lista</button>
        </div>
      </div>

      {mode === "kanban" ? (
        <div className="kanban">
          {cols.map((c) => (
            <div className="kcol" key={c.key}>
              <div className="kcol-head">
                <span className="dot" style={{ background: c.color }}></span>
                {c.label}
                <span className="cnt">{c.items.length}</span>
              </div>
              {c.items.map((it) => <KCard key={it.id} it={{ ...it, etapa: c.key }} onOpen={onOpen} />)}
            </div>
          ))}
        </div>
      ) : (
        <div className="list-rows">
          {allRows.map((it) => (
            <div className="lrow" key={it.id} onClick={() => onOpen && onOpen(it)}>
              <Avatar iniciales={it.iniciales} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="lr-name">{it.nombre}</div>
                <div className="lr-note">{it.nota}</div>
              </div>
              <div className="lr-stage"><StageTag etapa={it.etapa} /></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function KCard({ it, onOpen }) {
  return (
    <div className="kcard" onClick={() => onOpen && onOpen(it)}>
      <div className="kc-top">
        <Avatar iniciales={it.iniciales} />
        <span className="kc-name">{it.nombre}</span>
      </div>
      {it.nota && <p className="kc-note">{it.nota}</p>}
      <div className="kc-foot">
        {it.seÃ±ales.map((s, i) => (
          <span key={i} className={"signal" + (s === "venta" ? " venta" : s.includes("reuniÃ³n") ? " reunion" : "")}>{s}</span>
        ))}
        {it.dias != null && <span className="kc-dias">{it.dias}d</span>}
      </div>
    </div>
  );
}

/* ============================================================
   NUEVO CONTACTO â€” modal corto (5 segundos)
   ============================================================ */
function NuevoContacto({ onClose, onSave }) {
  const [nombre, setNombre] = useStateV("");
  const [tel, setTel] = useStateV("");
  const [cumple, setCumple] = useStateV("");
  const [necesidad, setNecesidad] = useStateV("");
  const [ante, setAnte] = useStateV("");
  const [etapa, setEtapa] = useStateV("caliente");
  const [saving, setSaving] = useStateV(false);
  const stageOrder = ["caliente", "media", "fria", "sin"];
  const EMAP = {caliente:'Caliente',media:'Media',fria:'Fria',sin:'Sin Etapa'};

  async function guardar() {
    if (!nombre.trim()) return;
    setSaving(true);
    try {
      const digits = tel.replace(/\D/g,'');
      if (window.CRM_API) {
        await window.CRM_API.post('/contactos', {
          nombre: nombre.trim(), cliente: nombre.trim(),
          telefono: tel.trim(),
          whatsapp_link: digits ? 'https://wa.me/54' + digits : '',
          necesidad: necesidad.trim(),
          antecedente: ante.trim(),
          etapa: EMAP[etapa] || 'Sin Etapa',
          fecha_nacimiento: cumple || '',
        });
      }
      onSave(nombre.trim());
    } catch(e) { alert('Error al guardar: ' + e.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="m-kicker">MT90 Tracción</div>
        <h2>Nuevo contacto</h2>
        <div className="field">
          <label>Nombre</label>
          <input autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Axel" />
        </div>
        <div className="field-row">
          <div className="field">
            <label>Teléfono <span className="opt">· sin +54</span></label>
            <input value={tel} onChange={(e) => setTel(e.target.value)} placeholder="11 5926 7961" />
          </div>
          <div className="field">
            <label>Cumpleaños <span className="opt">· opcional</span></label>
            <input type="date" value={cumple} onChange={(e) => setCumple(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label>¿Qué necesita? <span className="opt">· opcional</span></label>
          <input value={necesidad} onChange={(e) => setNecesidad(e.target.value)} placeholder="Vender, comprar, alquilar…" />
        </div>
        <div className="field">
          <label>Antecedente <span className="opt">· opcional</span></label>
          <textarea rows="2" value={ante} onChange={(e) => setAnte(e.target.value)} placeholder="Cómo lo conociste · referido, radar, open house…"></textarea>
          <div className="hint">Te ayuda a recordar de dónde salió el contacto.</div>
        </div>
        <div className="field">
          <label>Etapa</label>
          <div className="dstage-picker">
            {stageOrder.map((k) => {
              const s = STAGE[k];
              const active = etapa === k;
              return (
                <button type="button" key={k} className={"dstage-opt" + (active ? " active" : "")}
                  style={active ? { borderColor: s.color, background: s.soft, color: s.color } : null}
                  onClick={() => setEtapa(k)}>
                  <span className="dot" style={{ background: s.color }}></span>{s.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="modal-actions">
          <button className="save" onClick={guardar} disabled={saving}>{saving ? 'Guardando…' : 'Guardar contacto'}</button>
          <button className="cancel" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   DETALLE DE CONTACTO â€” panel lateral
   Se abre al tocar cualquier tarjeta. Funciona con contactos de
   "Hoy" (datos completos) y de "Cartera" (datos parciales).
   ============================================================ */
function ContactoDetalle({ c, done, onToggleDone, onWhatsapp, onClose, onUpdate }) {
  const dias = c.diasSinContacto != null ? c.diasSinContacto : (c.dias != null ? c.dias : null);
  const necesidad = c.necesidad || c.nota || "";
  const [accion, setAccion] = useStateV(c.proximaAccion || "");
  const [etapa, setEtapa] = useStateV(c.etapa || "sin");
  const [copied, setCopied] = useStateV(false);
  const [saving, setSaving] = useStateV(false);
  const hecho = !!(done && done[c.id]);
  const urgente = esUrgente(dias);
  const cumpleHoy = esCumpleHoy(c.cumple);
  const mensaje = cumpleHoy ? mensajeCumple(c.nombre) : c.mensaje;

  useEffectV(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function copiar() {
    if (mensaje && navigator.clipboard) navigator.clipboard.writeText(mensaje).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function saveEtapa(k) {
    setEtapa(k);
    if (c.id && window.CRM_API) {
      const EMAP = {caliente:'Caliente',media:'Media',fria:'Fria',sin:'Sin Etapa'};
      window.CRM_API.put('/contactos/' + c.id, {etapa: EMAP[k] || 'Sin Etapa'}).then(() => { if(onUpdate) onUpdate(); }).catch(console.error);
    }
  }

  function saveAccion() {
    if (c.id && accion !== c.proximaAccion && window.CRM_API) {
      window.CRM_API.put('/contactos/' + c.id, {proxima_accion: accion}).catch(console.error);
    }
  }

  function eliminar() {
    if (!c.id || !window.CRM_API) return;
    if (!confirm('¿Eliminar a ' + c.nombre + '? Esta acción no se puede deshacer.')) return;
    window.CRM_API.delete('/contactos/' + c.id).then(() => { onClose(); if(onUpdate) onUpdate(); }).catch(e => alert('Error: ' + e.message));
  }

  const stageOrder = ["caliente", "media", "fria", "sin"];

  return (
    <React.Fragment>
      <div className="drawer-backdrop" onClick={onClose}></div>
      <aside className="drawer" role="dialog" aria-label={"Detalle de " + c.nombre}>
        <button className="drawer-close" onClick={onClose} aria-label="Cerrar"><Icon.x /></button>
        <div className="drawer-scroll">
          <div className="dh">
            <Avatar iniciales={c.iniciales} />
            <div style={{ minWidth: 0 }}>
              <h2 className="dh-name">{c.nombre}</h2>
              <div className="dh-sub">
                <StageTag etapa={etapa} />
                {dias != null && <span className={"dh-time" + (urgente ? " warn" : "")}>{tiempoSinHablar(dias)}</span>}
              </div>
            </div>
          </div>

          {cumpleHoy && (
            <div className="bday-note"><Icon.gift /> <b>Hoy es su cumpleaños.</b> Aprovechá para saludar.</div>
          )}

          <button className="btn-wa-full" onClick={() => onWhatsapp({ ...c, mensaje })}>
            <Icon.wa /> {cumpleHoy ? "Saludar por WhatsApp" : "Escribir por WhatsApp"}
          </button>

          <div className="dsection">
            <div className="dlabel"><Icon.target /> Qué querés lograr <span className="auto">· se guarda solo</span></div>
            <textarea
              className="daction-input"
              value={accion}
              placeholder="Anotá la próxima acción con esta persona…"
              onChange={(e) => setAccion(e.target.value)}
              onBlur={saveAccion}
            />
          </div>

          {mensaje && (
            <div className="dsection">
              <div className="dlabel"><Icon.wa /> {cumpleHoy ? "Saludo de cumpleaños" : "Mensaje sugerido"}</div>
              <div className="dmsg">{mensaje}</div>
              <div className="dmsg-actions">
                <button className={"dmsg-btn" + (copied ? " copied" : "")} onClick={copiar}>
                  {copied ? <React.Fragment><Icon.check /> Copiado</React.Fragment> : <React.Fragment><Icon.copy /> Copiar</React.Fragment>}
                </button>
                <button className="dmsg-btn" onClick={() => onWhatsapp({ ...c, mensaje })}><Icon.arrow /> Abrir chat</button>
              </div>
            </div>
          )}

          <div className="dsection">
            <div className="dlabel">Datos</div>
            <div className="dfacts">
              {necesidad && <div className="dfact"><span className="k">Necesita</span><span className="v">{necesidad}</span></div>}
              {c.cumple && <div className="dfact"><span className="k">Cumpleaños</span><span className="v">{formatoCumple(c.cumple)}{cumpleHoy ? " · hoy" : ""}</span></div>}
              {c.telefono && <div className="dfact"><span className="k">Teléfono</span><span className="v"><a href={"tel:+54" + c.telefono}>+54 {c.telefono}</a></span></div>}
              {c.contexto && c.contexto.length > 0 && (
                <div className="dfact"><span className="k">Contexto</span><span className="v"><span className="dchips">{c.contexto.map((x, i) => <span className="chip" key={i}>{x}</span>)}</span></span></div>
              )}
            </div>
          </div>

          <div className="dsection">
            <div className="dlabel">Etapa</div>
            <div className="dstage-picker">
              {stageOrder.map((k) => {
                const s = STAGE[k];
                const active = etapa === k;
                return (
                  <button key={k} className={"dstage-opt" + (active ? " active" : "")}
                    style={active ? { borderColor: s.color, background: s.soft, color: s.color } : null}
                    onClick={() => saveEtapa(k)}>
                    <span className="dot" style={{ background: s.color }}></span>{s.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="drawer-foot">
          <button className={"btn btn-done" + (hecho ? " is-done" : "")} onClick={() => onToggleDone && onToggleDone(c.id)}>
            <Icon.check /> {hecho ? "Ya hablé hoy" : "Marcar como hablado"}
          </button>
          <button onClick={eliminar} style={{background:'transparent',border:'1px solid #fecaca',color:'#dc2626',borderRadius:'11px',padding:'12px 16px',fontWeight:600,fontFamily:'inherit',cursor:'pointer',fontSize:'calc(14px * var(--fs-scale))'}}>Eliminar</button>
        </div>
      </aside>
    </React.Fragment>
  );
}

Object.assign(window, { HoyLista, HoyEnfoque, InicioAsistente, Cartera, NuevoContacto, PersonCard, ContactoDetalle });

