// "HOY" MÍNIMA — solo 4 tipos de tarea (spec UX sección 4, alcance acotado
// a esto por ahora): contactos que piensan mudarse, recomendaciones por
// validar, canjes por entregar y envíos del mes pendientes. Se agrega
// ARRIBA de la pantalla "Hoy" de siempre, sin tocarla.
const { useState: useStateHT, useEffect: useEffectHT } = React;

function HoyTareas() {
  const [datos, setDatos] = useStateHT(null);
  const [ocupado, setOcupado] = useStateHT(null);

  function cargar() {
    window.CRM_API.get("/hoy/tareas").then(setDatos).catch(() =>
      setDatos({ mudanza: [], recomendaciones_por_validar: [], canjes_por_entregar: [], envios_pendientes: [] })
    );
  }
  useEffectHT(cargar, []);

  function abrirWhatsapp(telefono, mensaje) {
    const digits = (telefono || "").replace(/\D/g, "");
    window.open("https://wa.me/" + (digits ? "549" + digits : "") + "?text=" + encodeURIComponent(mensaje || ""), "mt90_hoy_whatsapp");
  }
  async function validar(id) {
    setOcupado("val" + id);
    try { await window.CRM_API.post(`/club/recomendaciones/${id}/validar`, {}); cargar(); } catch (e) {}
    setOcupado(null);
  }
  async function marcarEnviado(cid) {
    setOcupado("env" + cid);
    try { await window.CRM_API.post(`/club/envio_mes/${cid}/marcar`, {}); cargar(); } catch (e) {}
    setOcupado(null);
  }

  if (!datos) return null;
  const total = datos.mudanza.length + datos.recomendaciones_por_validar.length + datos.canjes_por_entregar.length + datos.envios_pendientes.length;

  return (
    <div className="club-tarea-lista fade-in">
      <div style={{ marginBottom: 14 }}>
        <h1 style={{ fontSize: "1.25rem", margin: 0 }}>Tareas de hoy</h1>
      </div>

      {total === 0 && (
        <div className="club-vacio">
          <p>Estás al día — no tenés tareas del Club pendientes ahora mismo.</p>
        </div>
      )}

      {datos.mudanza.map((c) => (
        <div className="club-row" key={"mud" + c.id}>
          <div className="club-row-main">
            <div className="club-row-title">{c.nombre}</div>
            <div className="club-row-sub">Dijo que piensa mudarse</div>
          </div>
          <div className="club-row-actions">
            <a className="club-btn" href={"tel:+54" + (c.telefono || "").replace(/\D/g, "")}>Llamar</a>
          </div>
        </div>
      ))}

      {datos.recomendaciones_por_validar.map((r) => (
        <div className="club-row" key={"rec" + r.id}>
          <div className="club-row-main">
            <div className="club-row-title">{r._recomienda || "—"} → {r._recomendado || "—"}</div>
            <div className="club-row-sub">Recomendación por validar</div>
          </div>
          <div className="club-row-actions">
            <button className="club-btn" disabled={ocupado === "val" + r.id} onClick={() => validar(r.id)}>
              {ocupado === "val" + r.id ? "…" : "Validar"}
            </button>
          </div>
        </div>
      ))}

      {datos.canjes_por_entregar.map((c) => (
        <div className="club-row" key={"canj" + c.id}>
          <div className="club-row-main">
            <div className="club-row-title">{c._contacto || "—"} · {c._beneficio || "—"}</div>
            <div className="club-row-sub">Canje pedido</div>
          </div>
          <div className="club-row-actions">
            <button
              className="club-btn-secundario"
              onClick={() => abrirWhatsapp(c._contacto_telefono, `Hola ${(c._contacto || "").split(" ")[0]}! Te escribo para coordinar la entrega de "${c._beneficio}" del Club de referidos.`)}
            >
              Coordinar entrega
            </button>
          </div>
        </div>
      ))}

      {datos.envios_pendientes.map((c) => (
        <div className="club-row" key={"env" + c.id}>
          <div className="club-row-main">
            <div className="club-row-title">{c.nombre}</div>
            <div className="club-row-sub">Envío del mes pendiente</div>
          </div>
          <div className="club-row-actions">
            <button className="club-btn-secundario" onClick={() => abrirWhatsapp(c.telefono, c.mensaje)}>Abrir WhatsApp</button>
            <button className="club-btn" disabled={ocupado === "env" + c.id} onClick={() => marcarEnviado(c.id)}>
              {ocupado === "env" + c.id ? "…" : "Marcar enviado"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { HoyTareas });
