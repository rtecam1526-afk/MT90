// VISITAS QUE CIERRAN — agenda con precalificación, checklist de salida de
// 3 toques, y seguimiento a 24hs/3 días. Usa la propiedad de Dueño Vende y
// la etapa (caliente/tibio/frío) que el contacto ya tiene — no inventa
// escalas nuevas.
const { useState: useStateVQ, useEffect: useEffectVQ } = React;

const VQ_ESTADO_LABEL = { agendada: "Agendada", realizada: "Realizada", cancelada: "Cancelada", no_asistio: "No asistió" };
const VQ_ESTADO_CLASE = { agendada: "media", realizada: "buena", cancelada: "baja", no_asistio: "baja" };
const VQ_COMPRA_LABEL = {
  ahorros: "Con ahorros", credito_preaprobado: "Crédito pre-aprobado", credito_no_aprobado: "Crédito (sin aprobar aún)",
  vendiendo_publicada: "Vendiendo otra (publicada)", vendiendo_no_publicada: "Vendiendo otra (sin publicar)",
};
const VQ_TIMING_LABEL = { ya: "Ya", "3_meses": "3 meses", "6_meses": "6 meses", explorando: "Explorando" };
const VQ_COMPETENCIA_LABEL = { nada: "Nada más", "1_a_3": "1 a 3 propiedades", muchas: "Muchas" };
const VQ_OBJECION_LABEL = {
  precio: "Precio", estado: "Estado", ubicacion: "Ubicación", tamano: "Tamaño", distribucion: "Distribución",
  luz: "Luz", expensas: "Expensas", financiacion: "Financiación", otra: "Otra", ninguna: "Ninguna",
};
const VQ_PROXIMO_LABEL = { ofertar: "Va a ofertar", segunda_visita: "2.ª visita", pensarlo: "Lo piensa", descarta: "Descarta", sin_definir: "Sin definir" };
const VQ_INTERES_OPCIONES = [
  { v: 5, emoji: "😀", label: "Mucho" },
  { v: 3, emoji: "🙂", label: "Algo" },
  { v: 1, emoji: "😐", label: "Poco" },
];

function vqFechaInputAIso(v) {
  // <input type="datetime-local"> da "2026-11-05T17:00" SIN zona horaria — si se
  // manda tal cual, Postgres lo interpreta en UTC y la hora queda corrida 3hs.
  // Argentina es UTC-3 todo el año (sin horario de verano), así que se fija
  // explícito acá.
  return v ? v + ":00-03:00" : v;
}
function vqFechaCorta(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }) + " " + d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  } catch (e) { return iso || ""; }
}

/* ── Registrar rápido una propiedad ya captada (sin pasar por Dueño Vende —
   un agente puede tener algo captado por referido, boca a boca, etc.) ──── */
function VQNuevaPropiedadCaptada({ onCreada, onCancelar }) {
  const [dueno, setDueno] = useStateVQ(null);
  const [barrio, setBarrio] = useStateVQ("");
  const [tipo, setTipo] = useStateVQ("depto");
  const [ambientes, setAmbientes] = useStateVQ("");
  const [moneda, setMoneda] = useStateVQ("USD");
  const [precio, setPrecio] = useStateVQ("");
  const [guardando, setGuardando] = useStateVQ(false);
  const [error, setError] = useStateVQ(null);

  async function guardar() {
    if (!dueno || !barrio.trim()) return;
    setGuardando(true);
    setError(null);
    try {
      const r = await window.CRM_API.post("/duenovende/propiedades", {
        contacto_id: dueno.id, barrio: barrio.trim(), tipo,
        ambientes: ambientes ? parseInt(ambientes, 10) : null,
        moneda, precio_publicado_actual: precio ? parseFloat(precio) : null,
      });
      const prop = r.propiedad;
      await window.CRM_API.put("/duenovende/propiedades/" + prop.id, { estado: "captada" });
      onCreada({ ...prop, estado: "captada" });
    } catch (e) {
      setError(e.message);
    }
    setGuardando(false);
  }

  return (
    <div className="dv-contacto-nuevo" style={{ border: "1.5px dashed var(--line-strong)", borderRadius: 12, padding: 12, marginTop: 6 }}>
      {!dueno ? (
        <DVBuscarContacto onPick={setDueno} />
      ) : (
        <div className="dv-contacto-chip">Dueño: {dueno.nombre || "Sin nombre"} <button type="button" onClick={() => setDueno(null)}>cambiar</button></div>
      )}
      <input value={barrio} onChange={(e) => setBarrio(e.target.value)} placeholder="Barrio" />
      <div className="field-row">
        <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="depto">Depto</option><option value="ph">PH</option><option value="casa">Casa</option>
          <option value="terreno">Terreno</option><option value="local">Local</option><option value="otro">Otro</option>
        </select>
        <input type="number" value={ambientes} onChange={(e) => setAmbientes(e.target.value)} placeholder="Ambientes" />
      </div>
      <div className="field-row">
        <select value={moneda} onChange={(e) => setMoneda(e.target.value)}><option value="USD">USD</option><option value="ARS">$ (pesos)</option></select>
        <input type="number" value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder="Precio" />
      </div>
      {error && <p className="tq-error">{error}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className="camp-start" disabled={guardando || !dueno || !barrio.trim()} onClick={guardar}>{guardando ? "Guardando…" : "Usar esta propiedad"}</button>
        <button type="button" className="dv-link-btn" onClick={onCancelar}>Cancelar</button>
      </div>
    </div>
  );
}

/* ── Agendar visita (propiedad + comprador + precalificación) ────────── */
function VQAgendar({ onClose, onSave }) {
  const [propiedades, setPropiedades] = useStateVQ(null);
  const [propiedadId, setPropiedadId] = useStateVQ("");
  const [nuevaPropiedad, setNuevaPropiedad] = useStateVQ(false);
  const [comprador, setComprador] = useStateVQ(null);
  const [fecha, setFecha] = useStateVQ("");
  const [compra, setCompra] = useStateVQ("");
  const [timing, setTiming] = useStateVQ("");
  const [competencia, setCompetencia] = useStateVQ("");
  const [guardando, setGuardando] = useStateVQ(false);
  const [error, setError] = useStateVQ(null);
  const [resultado, setResultado] = useStateVQ(null);
  const [copiado, setCopiado] = useStateVQ(false);

  useEffectVQ(() => {
    window.CRM_API.get("/duenovende/propiedades").then((r) => {
      setPropiedades((r.propiedades || []).filter((p) => p.estado === "captada" || p.estado === "autorizacion"));
    }).catch(() => setPropiedades([]));
  }, []);

  async function guardar() {
    if (!propiedadId || !comprador || !fecha) return;
    setGuardando(true);
    setError(null);
    try {
      const r = await window.CRM_API.post("/visitas", {
        propiedad_id: parseInt(propiedadId, 10), comprador_id: comprador.id, fecha_hora: vqFechaInputAIso(fecha),
        precalificacion_compra: compra || null, precalificacion_timing: timing || null, precalificacion_competencia: competencia || null,
      });
      setResultado(r);
    } catch (e) {
      setError(e.message);
    }
    setGuardando(false);
  }

  async function confirmarEtapa() {
    if (!resultado || !resultado.sugerencia_etapa) return;
    const EMAP = { caliente: "Caliente", media: "Media", fria: "Fria" };
    try {
      await window.CRM_API.put("/contactos/" + comprador.id, { etapa: EMAP[resultado.sugerencia_etapa.etapa] });
      setResultado({ ...resultado, sugerencia_etapa: null });
    } catch (e) {}
  }

  function abrirWhatsapp() {
    if (!resultado || !comprador) return;
    const digits = (comprador.telefono || "").replace(/\D/g, "");
    const url = "https://wa.me/" + (digits ? "549" + digits : "") + "?text=" + encodeURIComponent(resultado.mensaje_precalificacion);
    window.open(url, "mt90_vq_whatsapp");
  }

  if (resultado) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="m-kicker">Visitas que cierran</div>
          <h2>¡Visita agendada!</h2>

          {resultado.sugerencia_etapa && (
            <div className="mb-banner mb-media" style={{ marginBottom: 14 }}>
              <span className="mb-icon">🌡️</span>
              <span className="mb-texto">{resultado.sugerencia_etapa.motivo}</span>
              <button className="camp-start" style={{ marginLeft: "auto" }} onClick={confirmarEtapa}>Sí, cambiar</button>
            </div>
          )}

          <div className="dsection">
            <div className="dlabel"><Icon.wa /> Mensaje para confirmar la visita</div>
            <div className="dmsg">{resultado.mensaje_precalificacion}</div>
            <div className="dmsg-actions">
              <button className={"dmsg-btn" + (copiado ? " copied" : "")} onClick={() => { navigator.clipboard && navigator.clipboard.writeText(resultado.mensaje_precalificacion); setCopiado(true); setTimeout(() => setCopiado(false), 1600); }}>
                {copiado ? <React.Fragment><Icon.check /> Copiado</React.Fragment> : <React.Fragment><Icon.copy /> Copiar</React.Fragment>}
              </button>
              <button className="dmsg-btn" onClick={abrirWhatsapp}><Icon.arrow /> Abrir chat</button>
            </div>
          </div>

          <div className="modal-actions">
            <button className="save" onClick={() => { onSave(); onClose(); }}>Listo</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="m-kicker">Visitas que cierran</div>
        <h2>Agendar visita</h2>

        <div className="field">
          <label>Propiedad captada</label>
          {!nuevaPropiedad ? (
            <React.Fragment>
              {propiedades === null ? <p className="tq-muted">Cargando…</p> : propiedades.length === 0 ? (
                <p className="tq-muted">Todavía no tenés ninguna propiedad captada cargada.</p>
              ) : (
                <select value={propiedadId} onChange={(e) => setPropiedadId(e.target.value)}>
                  <option value="">Elegí una propiedad…</option>
                  {propiedades.map((p) => (
                    <option key={p.id} value={p.id}>{(p.barrio || "").replace(/-/g, " ")} · {p.tipo} · {p.moneda} {p.precio_publicado_actual || "?"}</option>
                  ))}
                </select>
              )}
              <button type="button" className="dv-link-btn" style={{ marginTop: 8 }} onClick={() => setNuevaPropiedad(true)}>+ Es una propiedad captada nueva</button>
            </React.Fragment>
          ) : (
            <VQNuevaPropiedadCaptada
              onCancelar={() => setNuevaPropiedad(false)}
              onCreada={(p) => {
                setPropiedades((prev) => [...(prev || []), p]);
                setPropiedadId(String(p.id));
                setNuevaPropiedad(false);
              }}
            />
          )}
        </div>

        {!comprador ? (
          <DVBuscarContacto onPick={setComprador} />
        ) : (
          <div className="field">
            <label>Comprador</label>
            <div className="dv-contacto-chip">{comprador.nombre || "Sin nombre"} <button type="button" onClick={() => setComprador(null)}>cambiar</button></div>
          </div>
        )}

        <div className="field">
          <label>Fecha y hora</label>
          <input type="datetime-local" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>

        <div className="field">
          <label>¿Cómo compra? <span className="opt">· opcional, pero ayuda a precalificar</span></label>
          <div className="dstage-picker">
            {Object.entries(VQ_COMPRA_LABEL).map(([k, v]) => (
              <button type="button" key={k} className={"dstage-opt" + (compra === k ? " active" : "")} onClick={() => setCompra(compra === k ? "" : k)}>{v}</button>
            ))}
          </div>
        </div>
        <div className="field">
          <label>¿Para cuándo?</label>
          <div className="dstage-picker">
            {Object.entries(VQ_TIMING_LABEL).map(([k, v]) => (
              <button type="button" key={k} className={"dstage-opt" + (timing === k ? " active" : "")} onClick={() => setTiming(timing === k ? "" : k)}>{v}</button>
            ))}
          </div>
        </div>
        <div className="field">
          <label>¿Qué más está viendo?</label>
          <div className="dstage-picker">
            {Object.entries(VQ_COMPETENCIA_LABEL).map(([k, v]) => (
              <button type="button" key={k} className={"dstage-opt" + (competencia === k ? " active" : "")} onClick={() => setCompetencia(competencia === k ? "" : k)}>{v}</button>
            ))}
          </div>
        </div>

        {error && <p className="tq-error">{error}</p>}
        <div className="modal-actions">
          <button className="save" disabled={guardando || !propiedadId || !comprador || !fecha} onClick={guardar}>{guardando ? "Guardando…" : "Agendar visita"}</button>
          <button className="cancel" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

/* ── Checklist de salida (después de la visita) ──────────────────────── */
function VQChecklistSalida({ visita, onClose, onSave }) {
  const [interes, setInteres] = useStateVQ(null);
  const [objecion, setObjecion] = useStateVQ("");
  const [proximoPaso, setProximoPaso] = useStateVQ("");
  const [nota, setNota] = useStateVQ("");
  const [guardando, setGuardando] = useStateVQ(false);

  async function guardar() {
    setGuardando(true);
    try {
      await window.CRM_API.put("/visitas/" + visita.id, {
        estado: "realizada", interes, objecion_principal: objecion || null, proximo_paso: proximoPaso || null, nota: nota.trim() || null,
      });
      onSave();
      onClose();
    } catch (e) {
      alert(e.message);
    }
    setGuardando(false);
  }

  const comp = visita._comprador || {};
  const prop = visita._propiedad || {};

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="m-kicker">Visitas que cierran</div>
        <h2>¿Cómo fue la visita?</h2>
        <p className="aj-tip">{comp.nombre} · {(prop.barrio || "").replace(/-/g, " ")}</p>

        <div className="field">
          <label>¿Le interesó?</label>
          <div className="vq-emoji-row">
            {VQ_INTERES_OPCIONES.map((o) => (
              <button type="button" key={o.v} className={"vq-emoji-btn" + (interes === o.v ? " active" : "")} onClick={() => setInteres(o.v)}>
                <span className="vq-emoji">{o.emoji}</span><span>{o.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>¿Qué lo frenó?</label>
          <div className="dstage-picker">
            {Object.entries(VQ_OBJECION_LABEL).map(([k, v]) => (
              <button type="button" key={k} className={"dstage-opt" + (objecion === k ? " active" : "")} onClick={() => setObjecion(k)}>{v}</button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>¿Próximo paso?</label>
          <div className="dstage-picker">
            {Object.entries(VQ_PROXIMO_LABEL).map(([k, v]) => (
              <button type="button" key={k} className={"dstage-opt" + (proximoPaso === k ? " active" : "")} onClick={() => setProximoPaso(k)}>{v}</button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Nota <span className="opt">· opcional</span></label>
          <textarea rows="2" value={nota} onChange={(e) => setNota(e.target.value)}></textarea>
        </div>

        <div className="modal-actions">
          <button className="save" disabled={guardando} onClick={guardar}>{guardando ? "Guardando…" : "Guardar"}</button>
          <button className="cancel" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

/* ── Seguimientos pendientes ──────────────────────────────────────────── */
function VQSeguimientos({ pendientes, onHecho }) {
  const [marcando, setMarcando] = useStateVQ(null);

  async function marcarHecho(p) {
    setMarcando(p.visita_id + p.tipo);
    try {
      const campo = p.tipo === "24h" ? "seguimiento_24h_hecho" : "seguimiento_3d_hecho";
      await window.CRM_API.put("/visitas/" + p.visita_id, { [campo]: true });
      onHecho();
    } catch (e) {}
    setMarcando(null);
  }

  function abrirWhatsapp(p) {
    const digits = (p.comprador && p.comprador.telefono || "").replace(/\D/g, "");
    const url = "https://wa.me/" + (digits ? "549" + digits : "") + "?text=" + encodeURIComponent(p.mensaje);
    window.open(url, "mt90_vq_seg_whatsapp");
  }

  if (!pendientes || pendientes.length === 0) return null;

  return (
    <div className="dv-destaque-pendientes" style={{ marginBottom: 18 }}>
      {pendientes.map((p) => (
        <div className="mb-banner mb-media" key={p.visita_id + p.tipo}>
          <span className="mb-icon">⏰</span>
          <span className="mb-texto">
            Seguimiento de {p.tipo === "24h" ? "24hs" : "3 días"} con <b>{(p.comprador && p.comprador.nombre) || "el comprador"}</b>: {p.mensaje}
          </span>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button className="camp-start" onClick={() => abrirWhatsapp(p)}>Abrir WhatsApp</button>
            <button className="camp-start" style={{ background: "#ccc", color: "#333" }} disabled={marcando === p.visita_id + p.tipo} onClick={() => marcarHecho(p)}>Marcar hecho</button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Listado + orquestación ───────────────────────────────────────────── */
function Visitas() {
  const [visitas, setVisitas] = useStateVQ(null);
  const [error, setError] = useStateVQ(null);
  const [pendientes, setPendientes] = useStateVQ([]);
  const [modalAgendar, setModalAgendar] = useStateVQ(false);
  const [checklistDe, setChecklistDe] = useStateVQ(null);

  function cargar() {
    window.CRM_API.get("/visitas").then((r) => setVisitas(r.visitas || [])).catch((e) => setError(e.message));
    window.CRM_API.get("/visitas/seguimientos").then((r) => setPendientes(r.pendientes || [])).catch(() => {});
  }
  useEffectVQ(cargar, []);

  return (
    <div className="dv-wrap fade-in">
      <div className="dif-head">
        <h1>Visitas que cierran</h1>
        <p className="tq-muted">Precalificá antes, registrá en segundos después, y seguí a tiempo.</p>
      </div>

      <VQSeguimientos pendientes={pendientes} onHecho={cargar} />

      <div style={{ marginBottom: 16 }}>
        <button className="camp-start" onClick={() => setModalAgendar(true)}>+ Agendar visita</button>
      </div>

      {error && <p className="tq-error">{error}</p>}
      {!error && visitas === null && <p className="tq-muted">Cargando…</p>}
      {visitas && visitas.length === 0 && <p className="tq-muted">Todavía no agendaste ninguna visita.</p>}

      <div className="dv-listado">
        {visitas && visitas.map((v) => {
          const comp = v._comprador || {}, prop = v._propiedad || {};
          return (
            <div className="dv-prop-card" key={v.id} onClick={() => { if (v.estado === "agendada") setChecklistDe(v); }}>
              <div className="dv-prop-main">
                <div className="dv-prop-barrio">{comp.nombre || "Sin nombre"} <span className="tq-muted">· {(prop.barrio || "").replace(/-/g, " ")}</span></div>
                <div className="tq-muted" style={{ fontSize: 13 }}>{vqFechaCorta(v.fecha_hora)}{v.interes ? " · interés " + v.interes + "/5" : ""}{v.objecion_principal ? " · " + (VQ_OBJECION_LABEL[v.objecion_principal] || v.objecion_principal) : ""}</div>
              </div>
              <div className="dv-prop-side">
                {v.estado === "agendada" && <span className="dif-chip dif-chip-media">Tocá para cerrar</span>}
                <span className={"dif-chip dif-chip-" + (VQ_ESTADO_CLASE[v.estado] || "media")}>{VQ_ESTADO_LABEL[v.estado] || v.estado}</span>
              </div>
            </div>
          );
        })}
      </div>

      {modalAgendar && <VQAgendar onClose={() => setModalAgendar(false)} onSave={cargar} />}
      {checklistDe && <VQChecklistSalida visita={checklistDe} onClose={() => setChecklistDe(null)} onSave={cargar} />}
    </div>
  );
}

Object.assign(window, { VQ_ESTADO_LABEL, VQ_ESTADO_CLASE, VQ_OBJECION_LABEL, Visitas });
