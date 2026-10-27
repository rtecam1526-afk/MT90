// DUEÑO VENDE — captación de propietarios que publican por su cuenta.
// Pocos toques, oportunos, relevantes, bien escritos. El CRM nunca envía
// solo él mismo: prepara el texto y abre WhatsApp, el agente decide.
const { useState: useStateDV, useEffect: useEffectDV } = React;

const DV_ESTADO_LABEL = {
  nuevo: "Nuevo", en_contacto: "En contacto", conversacion: "Conversación",
  llamada_hecha: "Llamada hecha", autorizacion: "Autorización (sin exclusiva)",
  captada: "Captada", en_pausa: "En pausa", no_contactar: "No contactar",
  vendida_por_dueno: "Vendida por el dueño", descartada: "Descartada",
};
const DV_ESTADO_CLASE = {
  nuevo: "buena", en_contacto: "media", conversacion: "media", llamada_hecha: "media",
  autorizacion: "buena", captada: "buena", en_pausa: "baja", no_contactar: "baja",
  vendida_por_dueno: "baja", descartada: "baja",
};
const DV_TIPO_LABEL = { depto: "Depto", ph: "PH", casa: "Casa", terreno: "Terreno", local: "Local", otro: "Otro" };
const DV_ENFOQUE_LABEL = {
  comprador: "Comprador real", cambio_precio: "Cambio de precio",
  vende_para_comprar: "¿Vende para comprar?", zona: "Conocimiento de zona", cierre: "Cierre (último toque)",
};
const DV_RESULTADO_LABEL = {
  sin_respuesta: "Sin respuesta", visto: "Visto", positivo: "Respondió positivo",
  neutro: "Respondió neutro", rechazo: "Rechazo", no_contactar: "Pidió no contactar",
};

function dvMoneda(m, v) {
  if (v === null || v === undefined || v === "") return "—";
  return `${m === "ARS" ? "$" : "USD"} ${Math.round(v).toLocaleString("es-AR")}`;
}

/* ── Buscar o crear contacto (reutilizado en Propiedad y Búsqueda) ───── */
function DVBuscarContacto({ onPick }) {
  const [q, setQ] = useStateDV("");
  const [contactos, setContactos] = useStateDV(null);
  const [creandoNuevo, setCreandoNuevo] = useStateDV(false);
  const [nombreNuevo, setNombreNuevo] = useStateDV("");
  const [telNuevo, setTelNuevo] = useStateDV("");
  const [guardando, setGuardando] = useStateDV(false);

  useEffectDV(() => {
    if (!window.CRM_API) return;
    window.CRM_API.get("/contactos").then(setContactos).catch(() => setContactos([]));
  }, []);

  const res = q.trim() && contactos
    ? contactos.filter((c) => (c.nombre || "").toLowerCase().includes(q.toLowerCase())).slice(0, 6)
    : [];

  async function crear() {
    if (!nombreNuevo.trim()) return;
    setGuardando(true);
    try {
      const digits = telNuevo.replace(/\D/g, "");
      const r = await window.CRM_API.post("/contactos", {
        nombre: nombreNuevo.trim(), cliente: nombreNuevo.trim(), telefono: telNuevo.trim(),
        whatsapp_link: digits ? "https://wa.me/54" + digits : "",
      });
      onPick({ id: r.id, nombre: nombreNuevo.trim(), telefono: telNuevo.trim() });
    } catch (e) {
      alert("Error al crear el contacto: " + e.message);
    }
    setGuardando(false);
  }

  return (
    <div className="field">
      <label>Propietario / contacto</label>
      {!creandoNuevo ? (
        <React.Fragment>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre…" />
          {res.length > 0 && (
            <div className="dv-contacto-res">
              {res.map((c) => (
                <button type="button" key={c.id} className="dv-contacto-opt" onClick={() => onPick(c)}>
                  {c.nombre} {c.telefono ? <span className="opt">· {c.telefono}</span> : null}
                </button>
              ))}
            </div>
          )}
          <button type="button" className="dv-link-btn" onClick={() => setCreandoNuevo(true)}>+ Es un contacto nuevo</button>
        </React.Fragment>
      ) : (
        <div className="dv-contacto-nuevo">
          <input value={nombreNuevo} onChange={(e) => setNombreNuevo(e.target.value)} placeholder="Nombre (o 'Sin nombre')" />
          <input value={telNuevo} onChange={(e) => setTelNuevo(e.target.value)} placeholder="Teléfono · sin +54" />
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="camp-start" disabled={guardando || !nombreNuevo.trim()} onClick={crear}>
              {guardando ? "Creando…" : "Crear y usar"}
            </button>
            <button type="button" className="dv-link-btn" onClick={() => setCreandoNuevo(false)}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Carga rápida de propiedad ─────────────────────────────────────── */
function DVCargaPropiedad({ onClose, onSave }) {
  const [contacto, setContacto] = useStateDV(null);
  const [link, setLink] = useStateDV("");
  const [buscando, setBuscando] = useStateDV(false);
  const [barrio, setBarrio] = useStateDV("");
  const [calle, setCalle] = useStateDV("");
  const [tipo, setTipo] = useStateDV("depto");
  const [ambientes, setAmbientes] = useStateDV("");
  const [m2, setM2] = useStateDV("");
  const [moneda, setMoneda] = useStateDV("USD");
  const [precio, setPrecio] = useStateDV("");
  const [rasgos, setRasgos] = useStateDV("");
  const [fuente, setFuente] = useStateDV("portal");
  const [notas, setNotas] = useStateDV("");
  const [guardando, setGuardando] = useStateDV(false);
  const [error, setError] = useStateDV(null);

  async function buscarDatos() {
    if (!link.trim()) return;
    setBuscando(true);
    try {
      const info = await window.CRM_API.post("/duenovende/propiedades/previsualizar", { url: link.trim() });
      if (info.precio) {
        const num = (info.precio.match(/[\d.,]+/) || [""])[0].replace(/\./g, "").replace(",", ".");
        if (num) setPrecio(num);
        if (/ARS|\$/.test(info.precio) && !/USD/.test(info.precio)) setMoneda("ARS");
      }
      if (info.m2) setM2(String(info.m2));
      if (info.ambientes) setAmbientes(String(info.ambientes));
    } catch (e) {
      // no rompe el flujo — el agente completa a mano
    }
    setBuscando(false);
  }

  async function guardar() {
    if (!contacto || !barrio.trim() || !tipo) return;
    setGuardando(true);
    setError(null);
    try {
      await window.CRM_API.post("/duenovende/propiedades", {
        contacto_id: contacto.id, barrio: barrio.trim(), calle_referencia: calle.trim() || null,
        tipo, ambientes: ambientes ? parseInt(ambientes, 10) : null, m2_totales: m2 ? parseFloat(m2) : null,
        rasgos: rasgos.split(",").map((r) => r.trim()).filter(Boolean),
        moneda, precio_publicado_actual: precio ? parseFloat(precio) : null,
        fuente, link_aviso: link.trim() || null, notas_agente: notas.trim() || null,
      });
      onSave();
    } catch (e) {
      setError(e.message);
    }
    setGuardando(false);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="m-kicker">Dueño vende</div>
        <h2>Cargar propiedad</h2>

        <div className="field">
          <label>Link del aviso <span className="opt">· opcional, precarga lo que se pueda</span></label>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..." style={{ flex: 1 }} />
            <button type="button" className="dv-link-btn" disabled={!link.trim() || buscando} onClick={buscarDatos}>
              {buscando ? "Buscando…" : "Traer datos"}
            </button>
          </div>
        </div>

        {!contacto ? (
          <DVBuscarContacto onPick={setContacto} />
        ) : (
          <div className="field">
            <label>Propietario</label>
            <div className="dv-contacto-chip">{contacto.nombre || "Sin nombre"} <button type="button" onClick={() => setContacto(null)}>cambiar</button></div>
          </div>
        )}

        <div className="field-row">
          <div className="field"><label>Barrio</label><input value={barrio} onChange={(e) => setBarrio(e.target.value)} placeholder="Villa Urquiza" /></div>
          <div className="field"><label>Calle de referencia <span className="opt">· opcional</span></label><input value={calle} onChange={(e) => setCalle(e.target.value)} placeholder="Av. Triunvirato" /></div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Tipo</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {Object.entries(DV_TIPO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="field"><label>Ambientes</label><input type="number" value={ambientes} onChange={(e) => setAmbientes(e.target.value)} /></div>
          <div className="field"><label>m² <span className="opt">· opcional</span></label><input type="number" value={m2} onChange={(e) => setM2(e.target.value)} /></div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Moneda</label>
            <select value={moneda} onChange={(e) => setMoneda(e.target.value)}><option value="USD">USD</option><option value="ARS">$ (pesos)</option></select>
          </div>
          <div className="field"><label>Precio publicado</label><input type="number" value={precio} onChange={(e) => setPrecio(e.target.value)} /></div>
        </div>
        <div className="field">
          <label>Rasgos <span className="opt">· separados por coma</span></label>
          <input value={rasgos} onChange={(e) => setRasgos(e.target.value)} placeholder="balcón, cochera, luminoso" />
        </div>
        <div className="field">
          <label>Fuente</label>
          <select value={fuente} onChange={(e) => setFuente(e.target.value)}>
            <option value="portal">Portal</option><option value="cartel">Cartel en la calle</option>
            <option value="referido">Referido</option><option value="otro">Otro</option>
          </select>
        </div>
        <div className="field">
          <label>Notas <span className="opt">· opcional</span></label>
          <textarea rows="2" value={notas} onChange={(e) => setNotas(e.target.value)}></textarea>
        </div>

        {error && <p className="tq-error">{error}</p>}
        <div className="modal-actions">
          <button className="save" disabled={guardando || !contacto || !barrio.trim()} onClick={guardar}>{guardando ? "Guardando…" : "Guardar propiedad"}</button>
          <button className="cancel" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

/* ── Carga de búsqueda de comprador ───────────────────────────────── */
function DVCargaBusqueda({ onClose, onSave }) {
  const [contacto, setContacto] = useStateDV(null);
  const [barrios, setBarrios] = useStateDV("");
  const [tipo, setTipo] = useStateDV("");
  const [moneda, setMoneda] = useStateDV("USD");
  const [pmin, setPmin] = useStateDV("");
  const [pmax, setPmax] = useStateDV("");
  const [ambientes, setAmbientes] = useStateDV("");
  const [rasgosExcl, setRasgosExcl] = useStateDV("");
  const [notas, setNotas] = useStateDV("");
  const [guardando, setGuardando] = useStateDV(false);
  const [error, setError] = useStateDV(null);

  async function guardar() {
    const barriosArr = barrios.split(",").map((b) => b.trim()).filter(Boolean);
    if (!contacto || barriosArr.length === 0) return;
    setGuardando(true);
    setError(null);
    try {
      await window.CRM_API.post("/duenovende/busquedas", {
        contacto_id: contacto.id, barrios: barriosArr, tipo: tipo || null,
        presupuesto_min: pmin ? parseFloat(pmin) : null, presupuesto_max: pmax ? parseFloat(pmax) : null,
        moneda, ambientes: ambientes ? parseInt(ambientes, 10) : null,
        rasgos_excluyentes: rasgosExcl.split(",").map((r) => r.trim()).filter(Boolean),
        notas: notas.trim() || null,
      });
      onSave();
    } catch (e) {
      setError(e.message);
    }
    setGuardando(false);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="m-kicker">Dueño vende</div>
        <h2>Cargar búsqueda de comprador</h2>
        <p className="aj-tip">Solo búsquedas reales — esto es lo que el sistema usa para sugerir el enfoque "comprador", nunca se inventa.</p>

        {!contacto ? (
          <DVBuscarContacto onPick={setContacto} />
        ) : (
          <div className="field">
            <label>Comprador</label>
            <div className="dv-contacto-chip">{contacto.nombre || "Sin nombre"} <button type="button" onClick={() => setContacto(null)}>cambiar</button></div>
          </div>
        )}

        <div className="field">
          <label>Barrios <span className="opt">· separados por coma</span></label>
          <input value={barrios} onChange={(e) => setBarrios(e.target.value)} placeholder="Villa Urquiza, Belgrano" />
        </div>
        <div className="field-row">
          <div className="field">
            <label>Tipo <span className="opt">· opcional</span></label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="">Cualquiera</option>
              {Object.entries(DV_TIPO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="field"><label>Ambientes <span className="opt">· opcional</span></label><input type="number" value={ambientes} onChange={(e) => setAmbientes(e.target.value)} /></div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Moneda</label>
            <select value={moneda} onChange={(e) => setMoneda(e.target.value)}><option value="USD">USD</option><option value="ARS">$ (pesos)</option></select>
          </div>
          <div className="field"><label>Presupuesto mín. <span className="opt">· opcional</span></label><input type="number" value={pmin} onChange={(e) => setPmin(e.target.value)} /></div>
          <div className="field"><label>Presupuesto máx.</label><input type="number" value={pmax} onChange={(e) => setPmax(e.target.value)} /></div>
        </div>
        <div className="field">
          <label>Rasgos excluyentes <span className="opt">· separados por coma, ej. "cochera"</span></label>
          <input value={rasgosExcl} onChange={(e) => setRasgosExcl(e.target.value)} />
        </div>
        <div className="field">
          <label>Notas <span className="opt">· opcional</span></label>
          <textarea rows="2" value={notas} onChange={(e) => setNotas(e.target.value)}></textarea>
        </div>

        {error && <p className="tq-error">{error}</p>}
        <div className="modal-actions">
          <button className="save" disabled={guardando || !contacto || !barrios.trim()} onClick={guardar}>{guardando ? "Guardando…" : "Guardar búsqueda"}</button>
          <button className="cancel" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

/* ── Mis búsquedas (panel simple) ─────────────────────────────────── */
function DVBusquedas({ onClose }) {
  const [busquedas, setBusquedas] = useStateDV(null);
  const [cargando, setCargando] = useStateDV(null);

  function cargar() {
    window.CRM_API.get("/duenovende/busquedas").then((r) => setBusquedas(r.busquedas || [])).catch(() => setBusquedas([]));
  }
  useEffectDV(cargar, []);

  async function toggleActiva(b) {
    setCargando(b.id);
    try {
      await window.CRM_API.put("/duenovende/busquedas/" + b.id, { activa: !b.activa });
      cargar();
    } catch (e) {}
    setCargando(null);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="m-kicker">Dueño vende</div>
        <h2>Mis búsquedas de comprador</h2>
        {busquedas === null && <p className="tq-muted">Cargando…</p>}
        {busquedas && busquedas.length === 0 && <p className="tq-muted">Todavía no cargaste ninguna búsqueda.</p>}
        <div className="dv-busquedas-list">
          {busquedas && busquedas.map((b) => (
            <div className="dv-busqueda-row" key={b.id}>
              <div>
                <div className="dv-busqueda-barrios">{(b.barrios || []).join(", ")}</div>
                <div className="tq-muted" style={{ fontSize: 12 }}>
                  {b.tipo ? DV_TIPO_LABEL[b.tipo] + " · " : ""}{b.ambientes ? b.ambientes + " amb · " : ""}
                  hasta {dvMoneda(b.moneda, b.presupuesto_max)}
                </div>
              </div>
              <button type="button" className={"dv-chip-toggle" + (b.activa ? " on" : "")} disabled={cargando === b.id} onClick={() => toggleActiva(b)}>
                {b.activa ? "Activa" : "Pausada"}
              </button>
            </div>
          ))}
        </div>
        <div className="modal-actions"><button className="cancel" onClick={onClose}>Cerrar</button></div>
      </div>
    </div>
  );
}

/* ── Panel de mensaje sugerido (dentro de la ficha) ───────────────── */
function DVPanelMensaje({ propiedad, contacto, coincidencias, onRegistrada }) {
  const enfoquesDisp = ["cambio_precio", "vende_para_comprar", "zona"];
  if (coincidencias && coincidencias.length > 0) enfoquesDisp.unshift("comprador");
  const [enfoque, setEnfoque] = useStateDV(enfoquesDisp[0]);
  const [generando, setGenerando] = useStateDV(false);
  const [variantes, setVariantes] = useStateDV(null);
  const [elegida, setElegida] = useStateDV("");
  const [error, setError] = useStateDV(null);
  const [preguntaEnvio, setPreguntaEnvio] = useStateDV(false);
  const [registrando, setRegistrando] = useStateDV(false);

  async function generar() {
    setGenerando(true);
    setError(null);
    setVariantes(null);
    setElegida("");
    try {
      const r = await window.CRM_API.post(`/duenovende/propiedades/${propiedad.id}/mensaje`, { enfoque });
      setVariantes(r.variantes || []);
      if (r.variantes && r.variantes[0]) setElegida(r.variantes[0]);
    } catch (e) {
      setError(e.message);
    }
    setGenerando(false);
  }

  function abrirWhatsapp() {
    if (!elegida.trim() || !contacto) return;
    const digits = (contacto.telefono || "").replace(/\D/g, "");
    const url = "https://wa.me/" + (digits ? "549" + digits : "") + "?text=" + encodeURIComponent(elegida);
    window.open(url, "mt90_dv_whatsapp");
    setPreguntaEnvio(true);
  }

  async function confirmarEnvio(seEnvio) {
    setRegistrando(true);
    try {
      await window.CRM_API.post(`/duenovende/propiedades/${propiedad.id}/interacciones`, {
        canal: "whatsapp", enfoque, mensaje_sugerido: (variantes || [])[0] || "", mensaje_enviado: seEnvio ? elegida : null,
        resultado: seEnvio ? "sin_respuesta" : null,
      });
      setPreguntaEnvio(false);
      setVariantes(null);
      onRegistrada && onRegistrada();
    } catch (e) {
      alert(e.message);
    }
    setRegistrando(false);
  }

  return (
    <div className="dsection">
      <div className="dlabel">Preparar mensaje</div>
      <div className="dstage-picker">
        {enfoquesDisp.map((k) => (
          <button type="button" key={k} className={"dstage-opt" + (enfoque === k ? " active" : "")} onClick={() => setEnfoque(k)}>
            {DV_ENFOQUE_LABEL[k]}
          </button>
        ))}
      </div>
      <button className="dmsg-btn" style={{ marginTop: 10 }} disabled={generando} onClick={generar}>
        {generando ? "Generando…" : "✨ Sugerir mensaje"}
      </button>
      {error && <p className="tq-error" style={{ marginTop: 8 }}>{error}</p>}

      {variantes && variantes.length > 0 && (
        <div style={{ marginTop: 12 }}>
          {variantes.map((v, i) => (
            <div key={i} className={"dv-variante" + (elegida === v ? " active" : "")} onClick={() => setElegida(v)}>
              {v}
            </div>
          ))}
          <textarea rows="3" className="dv-variante-edit" value={elegida} onChange={(e) => setElegida(e.target.value)} />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button className="dmsg-btn" onClick={generar}>↻ Regenerar</button>
            <button className="dmsg-btn" onClick={() => { navigator.clipboard && navigator.clipboard.writeText(elegida); }}>Copiar</button>
            <button className="camp-start" onClick={abrirWhatsapp}>Abrir en WhatsApp</button>
          </div>
        </div>
      )}

      {preguntaEnvio && (
        <div className="mb-banner mb-media" style={{ marginTop: 12 }}>
          <span className="mb-icon">💬</span>
          <span className="mb-texto">¿Lo enviaste?</span>
          <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
            <button className="camp-start" disabled={registrando} onClick={() => confirmarEnvio(true)}>Sí</button>
            <button className="camp-start" style={{ background: "#ccc", color: "#333" }} disabled={registrando} onClick={() => confirmarEnvio(false)}>No</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Ficha de propiedad ───────────────────────────────────────────── */
function DVFicha({ pid, onVolver }) {
  const [datos, setDatos] = useStateDV(null);
  const [error, setError] = useStateDV(null);
  const [motivoNoContactar, setMotivoNoContactar] = useStateDV("");
  const [marcandoNoContactar, setMarcandoNoContactar] = useStateDV(false);

  function cargar() {
    window.CRM_API.get("/duenovende/propiedades/" + pid).then(setDatos).catch((e) => setError(e.message));
  }
  useEffectDV(cargar, [pid]);

  async function cambiarEstado(nuevo) {
    try {
      await window.CRM_API.put("/duenovende/propiedades/" + pid, { estado: nuevo });
      cargar();
    } catch (e) { alert(e.message); }
  }

  async function marcarNoContactar() {
    setMarcandoNoContactar(true);
    try {
      await window.CRM_API.post(`/duenovende/propiedades/${pid}/no_contactar`, { motivo: motivoNoContactar || undefined });
      cargar();
    } catch (e) { alert(e.message); }
    setMarcandoNoContactar(false);
  }

  if (error) return <p className="tq-error">{error}</p>;
  if (!datos) return <p className="tq-muted">Cargando…</p>;
  const { propiedad: p, contacto, historial_precio, interacciones, coincidencias } = datos;

  return (
    <div className="fade-in">
      <button className="dv-link-btn" onClick={onVolver}>← Volver al listado</button>
      <div className="dv-ficha-head">
        <div>
          <h1>{(p.barrio || "").replace(/-/g, " ")} · {DV_TIPO_LABEL[p.tipo] || p.tipo}</h1>
          <p className="tq-muted">{contacto ? contacto.nombre : "Sin contacto"} {contacto && contacto.telefono ? "· " + contacto.telefono : ""}</p>
        </div>
        <span className={"dif-chip dif-chip-" + (DV_ESTADO_CLASE[p.estado] || "media")}>{DV_ESTADO_LABEL[p.estado] || p.estado}</span>
      </div>

      {contacto && contacto.no_contactar && (
        <div className="mb-banner mb-urgente"><span className="mb-icon">🚫</span><span className="mb-texto">Este contacto pidió no ser contactado{contacto.motivo_no_contactar ? ": " + contacto.motivo_no_contactar : ""}.</span></div>
      )}

      <div className="dsection">
        <div className="dlabel">Datos</div>
        <div className="dfacts">
          {p.calle_referencia && <div className="dfact"><span className="k">Calle</span><span className="v">{p.calle_referencia}</span></div>}
          {p.ambientes && <div className="dfact"><span className="k">Ambientes</span><span className="v">{p.ambientes}</span></div>}
          {p.m2_totales && <div className="dfact"><span className="k">m²</span><span className="v">{p.m2_totales}</span></div>}
          <div className="dfact"><span className="k">Precio</span><span className="v">{dvMoneda(p.moneda, p.precio_publicado_actual)}</span></div>
          <div className="dfact"><span className="k">Días publicada</span><span className="v">{p.dias_publicada != null ? p.dias_publicada : "—"}</span></div>
          {p.rasgos && p.rasgos.length > 0 && <div className="dfact"><span className="k">Rasgos</span><span className="v"><span className="dchips">{p.rasgos.map((r, i) => <span className="chip" key={i}>{r}</span>)}</span></span></div>}
          {p.link_aviso && <div className="dfact"><span className="k">Aviso</span><span className="v"><a href={p.link_aviso} target="_blank" rel="noreferrer">Ver publicación ↗</a></span></div>}
        </div>
      </div>

      {historial_precio && historial_precio.length > 1 && (
        <div className="dsection">
          <div className="dlabel">Historial de precio</div>
          <div className="dv-historial">
            {historial_precio.map((h, i) => (
              <div className="dv-historial-row" key={i}><span>{(h.fecha || "").slice(0, 10)}</span><span>{dvMoneda(h.moneda, h.precio)}</span></div>
            ))}
          </div>
        </div>
      )}

      {coincidencias && coincidencias.length > 0 && (
        <div className="dsection">
          <div className="dlabel">Coincidencias con búsquedas reales</div>
          {coincidencias.map((c) => (
            <div className="dv-coincidencia" key={c.id}>
              <div className="dv-coincidencia-top"><span className="dif-chip dif-chip-buena">{c.puntaje} pts</span><span>{c.perfil}</span></div>
              <div className="tq-muted" style={{ fontSize: 12 }}>{(c.motivos || []).join(" · ")}</div>
            </div>
          ))}
        </div>
      )}

      {!contacto || !contacto.no_contactar ? (
        <DVPanelMensaje propiedad={p} contacto={contacto} coincidencias={coincidencias} onRegistrada={cargar} />
      ) : null}

      {interacciones && interacciones.length > 0 && (
        <div className="dsection">
          <div className="dlabel">Historial de interacciones</div>
          {interacciones.map((it) => (
            <div className="dv-interaccion" key={it.id}>
              <div className="dv-interaccion-top">
                <span>Toque {it.numero_toque} · {DV_ENFOQUE_LABEL[it.enfoque] || it.enfoque} · {it.canal}</span>
                <span className="tq-muted">{(it.fecha || "").slice(0, 10)}</span>
              </div>
              {it.mensaje_enviado && <div className="dv-interaccion-msg">{it.mensaje_enviado}</div>}
              {it.resultado && <span className={"dif-chip dif-chip-" + (it.resultado === "positivo" ? "buena" : it.resultado === "rechazo" || it.resultado === "no_contactar" ? "baja" : "media")}>{DV_RESULTADO_LABEL[it.resultado] || it.resultado}</span>}
            </div>
          ))}
        </div>
      )}

      <div className="dsection">
        <div className="dlabel">Estado</div>
        <select value={p.estado} onChange={(e) => cambiarEstado(e.target.value)} style={{ padding: "8px 12px", borderRadius: 10, border: "1.5px solid var(--line-strong)", fontFamily: "inherit" }}>
          {Object.entries(DV_ESTADO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {(!contacto || !contacto.no_contactar) && (
        <div className="dsection">
          <input placeholder="Motivo (opcional)" value={motivoNoContactar} onChange={(e) => setMotivoNoContactar(e.target.value)} style={{ marginBottom: 8, width: "100%", maxWidth: 320, padding: "8px 12px", borderRadius: 10, border: "1.5px solid var(--line-strong)", fontFamily: "inherit" }} />
          <br />
          <button onClick={marcarNoContactar} disabled={marcandoNoContactar} style={{ background: "transparent", border: "1px solid #fecaca", color: "#dc2626", borderRadius: 11, padding: "10px 16px", fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
            🚫 No contactar
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Listado + orquestación ───────────────────────────────────────── */
function DuenoVende() {
  const [propiedades, setPropiedades] = useStateDV(null);
  const [error, setError] = useStateDV(null);
  const [fichaId, setFichaId] = useStateDV(null);
  const [modalCarga, setModalCarga] = useStateDV(false);
  const [modalBusqueda, setModalBusqueda] = useStateDV(false);
  const [modalBusquedas, setModalBusquedas] = useStateDV(false);
  const [filtroEstado, setFiltroEstado] = useStateDV("");

  function cargar() {
    const params = filtroEstado ? "?estado=" + filtroEstado : "";
    window.CRM_API.get("/duenovende/propiedades" + params).then((r) => setPropiedades(r.propiedades || [])).catch((e) => setError(e.message));
  }
  useEffectDV(cargar, [filtroEstado]);

  if (fichaId) return <div className="dv-wrap fade-in"><DVFicha pid={fichaId} onVolver={() => { setFichaId(null); cargar(); }} /></div>;

  return (
    <div className="dv-wrap fade-in">
      <div className="dif-head">
        <h1>Dueño vende</h1>
        <p className="tq-muted">Propietarios que publican por su cuenta — pocos toques, bien elegidos.</p>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <button className="camp-start" onClick={() => setModalCarga(true)}>+ Propiedad</button>
        <button className="dv-link-btn" onClick={() => setModalBusqueda(true)}>+ Búsqueda de comprador</button>
        <button className="dv-link-btn" onClick={() => setModalBusquedas(true)}>Mis búsquedas</button>
        <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} style={{ marginLeft: "auto", padding: "7px 10px", borderRadius: 10, border: "1.5px solid var(--line-strong)", fontFamily: "inherit" }}>
          <option value="">Todos los estados</option>
          {Object.entries(DV_ESTADO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {error && <p className="tq-error">{error}</p>}
      {!error && propiedades === null && <p className="tq-muted">Cargando…</p>}
      {propiedades && propiedades.length === 0 && <p className="tq-muted">Todavía no cargaste ninguna propiedad.</p>}

      <div className="dv-listado">
        {propiedades && propiedades.map((p) => (
          <div className="dv-prop-card" key={p.id} onClick={() => setFichaId(p.id)}>
            <div className="dv-prop-main">
              <div className="dv-prop-barrio">{(p.barrio || "").replace(/-/g, " ")} <span className="tq-muted">· {DV_TIPO_LABEL[p.tipo] || p.tipo}</span></div>
              <div className="tq-muted" style={{ fontSize: 13 }}>{dvMoneda(p.moneda, p.precio_publicado_actual)} · {p.dias_publicada != null ? p.dias_publicada + " días publicada" : "días s/d"}</div>
            </div>
            <div className="dv-prop-side">
              {p.coincidencias_count > 0 && <span className="dif-chip dif-chip-buena">{p.coincidencias_count} coincidencia{p.coincidencias_count === 1 ? "" : "s"}</span>}
              <span className={"dif-chip dif-chip-" + (DV_ESTADO_CLASE[p.estado] || "media")}>{DV_ESTADO_LABEL[p.estado] || p.estado}</span>
            </div>
          </div>
        ))}
      </div>

      {modalCarga && <DVCargaPropiedad onClose={() => setModalCarga(false)} onSave={() => { setModalCarga(false); cargar(); }} />}
      {modalBusqueda && <DVCargaBusqueda onClose={() => setModalBusqueda(false)} onSave={() => { setModalBusqueda(false); cargar(); }} />}
      {modalBusquedas && <DVBusquedas onClose={() => setModalBusquedas(false)} />}
    </div>
  );
}

Object.assign(window, { DV_ESTADO_LABEL, DV_ESTADO_CLASE, DV_TIPO_LABEL, DV_ENFOQUE_LABEL, DV_RESULTADO_LABEL, dvMoneda, DVBuscarContacto, DVCargaPropiedad, DVCargaBusqueda, DVBusquedas, DVPanelMensaje, DVFicha, DuenoVende });
