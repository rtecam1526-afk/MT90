// CLUB DE REFERIDOS — gestión del lado del agente. La página pública que
// ven los contactos vive aparte (templates/club_publico.html, sin login).
const { useState: useStateCL, useEffect: useEffectCL } = React;

const CLUB_SUBTABS = [
  ["inscripcion", "Inscriptos"],
  ["recomendaciones", "Recomendaciones"],
  ["beneficios", "Beneficios"],
  ["canjes", "Canjes"],
  ["envio", "Envío del mes"],
  ["perfil", "Mi perfil"],
];

const CLUB_ESTADO_LABEL = {
  recibida: "Recibida", contactada: "Contactada", reunion: "Reunión", visita: "Visita",
  tasacion: "Tasación", operacion: "Operación", descartada: "Descartada",
};
const CLUB_ESTADO_CLASE = {
  recibida: "media", contactada: "media", reunion: "buena", visita: "buena",
  tasacion: "buena", operacion: "buena", descartada: "baja",
};

/* ── Inscripción al club ──────────────────────────────────────────────── */
function ClubInscripcion() {
  const [contactos, setContactos] = useStateCL(null);
  const [q, setQ] = useStateCL("");
  const [seleccion, setSeleccion] = useStateCL({});
  const [cargando, setCargando] = useStateCL(null);
  const [copiadoId, setCopiadoId] = useStateCL(null);

  function cargar() {
    window.CRM_API.get("/club/contactos").then((r) => setContactos(r.contactos || [])).catch(() => setContactos([]));
  }
  useEffectCL(cargar, []);

  const filtrados = (contactos || []).filter((c) => !q.trim() || (c.nombre || "").toLowerCase().includes(q.toLowerCase()));
  const seleccionados = Object.keys(seleccion).filter((k) => seleccion[k]).map(Number);

  async function activar(cid) {
    setCargando(cid);
    try {
      await window.CRM_API.post(`/club/contactos/${cid}/activar`, {});
      cargar();
    } catch (e) { alert(e.message); }
    setCargando(null);
  }
  async function desactivar(cid) {
    setCargando(cid);
    try {
      await window.CRM_API.post(`/club/contactos/${cid}/desactivar`, {});
      cargar();
    } catch (e) { alert(e.message); }
    setCargando(null);
  }
  async function activarSeleccionados() {
    if (seleccionados.length === 0) return;
    setCargando("lote");
    try {
      await window.CRM_API.post("/club/contactos/activar_lote", { ids: seleccionados });
      setSeleccion({});
      cargar();
    } catch (e) { alert(e.message); }
    setCargando(null);
  }
  function copiarLink(c) {
    const url = window.location.origin + "/club/" + c.club_token;
    navigator.clipboard && navigator.clipboard.writeText(url);
    setCopiadoId(c.id);
    setTimeout(() => setCopiadoId(null), 1600);
  }

  return (
    <div className="fade-in">
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <input placeholder="Buscar por nombre…" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: "1 1 240px", padding: "9px 12px", borderRadius: 10, border: "1.5px solid var(--line-strong)", fontFamily: "inherit" }} />
        {seleccionados.length > 0 && (
          <button className="camp-start" disabled={cargando === "lote"} onClick={activarSeleccionados}>
            {cargando === "lote" ? "Inscribiendo…" : `Inscribir ${seleccionados.length} seleccionados`}
          </button>
        )}
      </div>
      {contactos === null && <p className="tq-muted">Cargando…</p>}
      <div className="dv-listado">
        {filtrados.map((c) => (
          <div className="dv-prop-card" key={c.id} style={{ cursor: "default" }}>
            {!c.club_activo && (
              <input type="checkbox" checked={!!seleccion[c.id]} onChange={(e) => setSeleccion((s) => ({ ...s, [c.id]: e.target.checked }))} style={{ width: 18, height: 18, marginRight: 4 }} />
            )}
            <div className="dv-prop-main">
              <div className="dv-prop-barrio" style={{ textTransform: "none" }}>{c.nombre || "Sin nombre"}</div>
              <div className="tq-muted" style={{ fontSize: 13 }}>{c.club_activo ? `${c.saldo} puntos` : (c.telefono || "sin teléfono")}</div>
            </div>
            <div className="dv-prop-side">
              {c.club_activo ? (
                <React.Fragment>
                  <button className="dv-link-btn" onClick={() => copiarLink(c)}>{copiadoId === c.id ? "¡Copiado!" : "Copiar link"}</button>
                  <button className="dv-link-btn" disabled={cargando === c.id} onClick={() => desactivar(c.id)}>Sacar del club</button>
                </React.Fragment>
              ) : (
                <button className="camp-start" disabled={cargando === c.id} onClick={() => activar(c.id)}>{cargando === c.id ? "…" : "Inscribir"}</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Recomendaciones ──────────────────────────────────────────────────── */
function ClubNuevaRecomendacion({ onClose, onCreada }) {
  const [recomienda, setRecomienda] = useStateCL(null);
  const [recomendado, setRecomendado] = useStateCL(null);
  const [guardando, setGuardando] = useStateCL(false);
  const [error, setError] = useStateCL(null);

  async function guardar() {
    if (!recomienda || !recomendado) return;
    setGuardando(true);
    setError(null);
    try {
      await window.CRM_API.post("/club/recomendaciones", { contacto_que_recomienda_id: recomienda.id, contacto_recomendado_id: recomendado.id });
      onCreada();
    } catch (e) { setError(e.message); }
    setGuardando(false);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="m-kicker">Club de referidos</div>
        <h2>Cargar recomendación</h2>
        <div className="field">
          <label>¿Quién recomendó?</label>
          {!recomienda ? <DVBuscarContacto onPick={setRecomienda} /> : (
            <div className="dv-contacto-chip">{recomienda.nombre} <button type="button" onClick={() => setRecomienda(null)}>cambiar</button></div>
          )}
        </div>
        <div className="field">
          <label>¿A quién recomendó?</label>
          {!recomendado ? <DVBuscarContacto onPick={setRecomendado} /> : (
            <div className="dv-contacto-chip">{recomendado.nombre} <button type="button" onClick={() => setRecomendado(null)}>cambiar</button></div>
          )}
        </div>
        {error && <p className="tq-error">{error}</p>}
        <div className="modal-actions">
          <button className="save" disabled={guardando || !recomienda || !recomendado} onClick={guardar}>{guardando ? "Guardando…" : "Guardar"}</button>
          <button className="cancel" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

function ClubRecomendaciones() {
  const [recos, setRecos] = useStateCL(null);
  const [modalNueva, setModalNueva] = useStateCL(false);
  const [cambiando, setCambiando] = useStateCL(null);

  function cargar() {
    window.CRM_API.get("/club/recomendaciones").then((r) => setRecos(r.recomendaciones || [])).catch(() => setRecos([]));
  }
  useEffectCL(cargar, []);

  async function cambiarEstado(id, estado) {
    setCambiando(id);
    try {
      await window.CRM_API.put(`/club/recomendaciones/${id}`, { estado });
      cargar();
    } catch (e) { alert(e.message); }
    setCambiando(null);
  }

  return (
    <div className="fade-in">
      <button className="camp-start" style={{ marginBottom: 14 }} onClick={() => setModalNueva(true)}>+ Cargar recomendación</button>
      {recos === null && <p className="tq-muted">Cargando…</p>}
      {recos && recos.length === 0 && <p className="tq-muted">Todavía no hay recomendaciones cargadas.</p>}
      <div className="dv-listado">
        {recos && recos.map((r) => (
          <div className="dv-prop-card" key={r.id} style={{ cursor: "default", flexWrap: "wrap" }}>
            <div className="dv-prop-main">
              <div className="dv-prop-barrio" style={{ textTransform: "none" }}>{r._recomienda || "—"} → {r._recomendado || "—"}</div>
              <div className="tq-muted" style={{ fontSize: 13 }}>{(r.fecha || "").slice(0, 10)} · {r.origen}</div>
            </div>
            <div className="dv-prop-side">
              <select value={r.estado} disabled={cambiando === r.id} onChange={(e) => cambiarEstado(r.id, e.target.value)} style={{ padding: "7px 10px", borderRadius: 10, border: "1.5px solid var(--line-strong)", fontFamily: "inherit" }}>
                {Object.entries(CLUB_ESTADO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <span className={"dif-chip dif-chip-" + (CLUB_ESTADO_CLASE[r.estado] || "media")}>{CLUB_ESTADO_LABEL[r.estado]}</span>
            </div>
          </div>
        ))}
      </div>
      {modalNueva && <ClubNuevaRecomendacion onClose={() => setModalNueva(false)} onCreada={() => { setModalNueva(false); cargar(); }} />}
    </div>
  );
}

/* ── Beneficios ────────────────────────────────────────────────────────── */
function ClubBeneficios() {
  const [beneficios, setBeneficios] = useStateCL(null);
  const [abierto, setAbierto] = useStateCL(false);
  const [nombre, setNombre] = useStateCL("");
  const [descripcion, setDescripcion] = useStateCL("");
  const [costo, setCosto] = useStateCL("");
  const [guardando, setGuardando] = useStateCL(false);

  function cargar() {
    window.CRM_API.get("/club/beneficios").then((r) => setBeneficios(r.beneficios || [])).catch(() => setBeneficios([]));
  }
  useEffectCL(cargar, []);

  async function crear() {
    if (!nombre.trim() || !costo) return;
    setGuardando(true);
    try {
      await window.CRM_API.post("/club/beneficios", { nombre: nombre.trim(), descripcion: descripcion.trim() || null, costo_puntos: parseInt(costo, 10) });
      setNombre(""); setDescripcion(""); setCosto(""); setAbierto(false);
      cargar();
    } catch (e) { alert(e.message); }
    setGuardando(false);
  }
  async function toggleActivo(b) {
    try {
      await window.CRM_API.put(`/club/beneficios/${b.id}`, { activo: !b.activo });
      cargar();
    } catch (e) {}
  }

  return (
    <div className="fade-in">
      <button className="camp-start" style={{ marginBottom: 14 }} onClick={() => setAbierto((v) => !v)}>{abierto ? "✕ Cancelar" : "+ Nuevo beneficio"}</button>
      {abierto && (
        <div className="dv-contacto-nuevo" style={{ border: "1.5px solid var(--line)", borderRadius: 12, padding: 14, marginBottom: 16 }}>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del beneficio" />
          <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Descripción (opcional)" />
          <input type="number" value={costo} onChange={(e) => setCosto(e.target.value)} placeholder="Costo en puntos" />
          <button className="camp-start" disabled={guardando || !nombre.trim() || !costo} onClick={crear}>{guardando ? "Guardando…" : "Guardar beneficio"}</button>
        </div>
      )}
      {beneficios === null && <p className="tq-muted">Cargando…</p>}
      <div className="dv-listado">
        {beneficios && beneficios.map((b) => (
          <div className="dv-prop-card" key={b.id} style={{ cursor: "default" }}>
            <div className="dv-prop-main">
              <div className="dv-prop-barrio" style={{ textTransform: "none" }}>{b.nombre}</div>
              <div className="tq-muted" style={{ fontSize: 13 }}>{b.costo_puntos} puntos{b.descripcion ? " · " + b.descripcion : ""}</div>
            </div>
            <div className="dv-prop-side">
              <button className={"dv-chip-toggle" + (b.activo ? " on" : "")} onClick={() => toggleActivo(b)}>{b.activo ? "Activo" : "Inactivo"}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Canjes (vista, Fase 1) ────────────────────────────────────────────── */
function ClubCanjes() {
  const [canjes, setCanjes] = useStateCL(null);
  useEffectCL(() => {
    window.CRM_API.get("/club/canjes").then((r) => setCanjes(r.canjes || [])).catch(() => setCanjes([]));
  }, []);
  return (
    <div className="fade-in">
      {canjes === null && <p className="tq-muted">Cargando…</p>}
      {canjes && canjes.length === 0 && <p className="tq-muted">Todavía no pidieron ningún canje.</p>}
      <div className="dv-listado">
        {canjes && canjes.map((c) => (
          <div className="dv-prop-card" key={c.id} style={{ cursor: "default" }}>
            <div className="dv-prop-main">
              <div className="dv-prop-barrio" style={{ textTransform: "none" }}>{(c._contacto && c._contacto.nombre) || "—"} · {(c._beneficio && c._beneficio.nombre) || "—"}</div>
              <div className="tq-muted" style={{ fontSize: 13 }}>{(c.fecha_pedido || "").slice(0, 10)} · {(c._beneficio && c._beneficio.costo_puntos) || "?"} puntos</div>
            </div>
            <div className="dv-prop-side">
              <span className={"dif-chip dif-chip-" + (c.estado === "entregado" ? "buena" : c.estado === "cancelado" ? "baja" : "media")}>{c.estado}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Envío del mes ─────────────────────────────────────────────────────── */
function ClubEnvio() {
  const [datos, setDatos] = useStateCL(null);
  const [marcando, setMarcando] = useStateCL(null);

  function cargar() {
    window.CRM_API.get("/club/envio_mes").then(setDatos).catch(() => setDatos({ contactos: [] }));
  }
  useEffectCL(cargar, []);

  function abrirWhatsapp(c) {
    const digits = (c.telefono || "").replace(/\D/g, "");
    window.open("https://wa.me/" + (digits ? "549" + digits : "") + "?text=" + encodeURIComponent(c.mensaje), "mt90_club_whatsapp");
  }
  async function marcar(c) {
    setMarcando(c.id);
    try {
      await window.CRM_API.post(`/club/envio_mes/${c.id}/marcar`, {});
      cargar();
    } catch (e) {}
    setMarcando(null);
  }

  if (!datos) return <p className="tq-muted">Cargando…</p>;
  const contactos = datos.contactos || [];
  if (contactos.length === 0) return <p className="tq-muted">Todavía no tenés contactos inscriptos en el club — andá a "Inscriptos" primero.</p>;

  return (
    <div className="fade-in">
      <p className="tq-muted" style={{ marginBottom: 14 }}>{datos.periodo} · {contactos.filter((c) => c.enviado).length} de {contactos.length} ya enviados</p>
      <div className="dv-listado">
        {contactos.map((c) => (
          <div className="dv-prop-card" key={c.id} style={{ cursor: "default", flexWrap: "wrap" }}>
            <div className="dv-prop-main">
              <div className="dv-prop-barrio" style={{ textTransform: "none" }}>{c.nombre}</div>
              <div className="tq-muted" style={{ fontSize: 13 }}>{c.respondio ? "Respondió la encuesta" : "Todavía no respondió"}</div>
            </div>
            <div className="dv-prop-side">
              {c.enviado ? (
                <span className="dif-chip dif-chip-buena">Enviado</span>
              ) : (
                <React.Fragment>
                  <button className="dv-link-btn" onClick={() => abrirWhatsapp(c)}>Abrir WhatsApp</button>
                  <button className="camp-start" disabled={marcando === c.id} onClick={() => marcar(c)}>Marcar enviado</button>
                </React.Fragment>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Mi perfil (color + teléfono para la página pública) ─────────────── */
function ClubPerfil() {
  const [color, setColor] = useStateCL("#E0633A");
  const [telefono, setTelefono] = useStateCL("");
  const [guardando, setGuardando] = useStateCL(false);
  const [msg, setMsg] = useStateCL("");

  useEffectCL(() => {
    window.CRM_API.get("/club/perfil").then((r) => { setColor(r.color || "#E0633A"); setTelefono(r.telefono || ""); }).catch(() => {});
  }, []);

  async function guardar() {
    setGuardando(true);
    setMsg("");
    try {
      await window.CRM_API.put("/club/perfil", { color, telefono: telefono.trim() });
      setMsg("Guardado.");
    } catch (e) { setMsg("Error: " + e.message); }
    setGuardando(false);
  }

  return (
    <div className="fade-in" style={{ maxWidth: 360 }}>
      <div className="field">
        <label>Color de tu página pública</label>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: 80, height: 44, padding: 2, borderRadius: 10, border: "1.5px solid var(--line-strong)" }} />
      </div>
      <div className="field">
        <label>Tu WhatsApp <span className="opt">· para el botón de respaldo en la encuesta</span></label>
        <input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="11 5555 5555" />
      </div>
      <button className="camp-start" disabled={guardando} onClick={guardar}>{guardando ? "Guardando…" : "Guardar"}</button>
      {msg && <p className="tq-muted" style={{ marginTop: 8 }}>{msg}</p>}
    </div>
  );
}

/* ── Orquestación ──────────────────────────────────────────────────────── */
function Club() {
  const [sub, setSub] = useStateCL("inscripcion");
  return (
    <div className="dv-wrap fade-in">
      <div className="dif-head">
        <h1>Club de referidos</h1>
        <p className="tq-muted">Tus contactos te recomiendan y responden una encuesta mensual, a cambio de puntos.</p>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
        {CLUB_SUBTABS.map(([k, label]) => (
          <button key={k} className={"dv-chip-toggle" + (sub === k ? " on" : "")} onClick={() => setSub(k)}>{label}</button>
        ))}
      </div>
      {sub === "inscripcion" && <ClubInscripcion />}
      {sub === "recomendaciones" && <ClubRecomendaciones />}
      {sub === "beneficios" && <ClubBeneficios />}
      {sub === "canjes" && <ClubCanjes />}
      {sub === "envio" && <ClubEnvio />}
      {sub === "perfil" && <ClubPerfil />}
    </div>
  );
}

Object.assign(window, { Club });
