// MODO OPERADOR — franja "Estás operando por…" + selector "Operar como…".
// Toda la sesión pasa a comportarse como el agente operado (ver backend),
// así el resto del CRM funciona igual sin tocarlo.
const { useState: useStateOP, useEffect: useEffectOP } = React;

function OperadorBanner() {
  const [estado, setEstado] = useStateOP(null);
  const [saliendo, setSaliendo] = useStateOP(false);

  useEffectOP(() => {
    if (!window.CRM_API) return;
    window.CRM_API.get("/operador/estado").then(setEstado).catch(() => {});
  }, []);

  async function salir() {
    setSaliendo(true);
    try {
      await window.CRM_API.post("/operador/salir", {});
      window.location.reload();
    } catch (e) {
      setSaliendo(false);
    }
  }

  if (!estado || !estado.operando) return null;
  return (
    <div className="club-banner-operador">
      Estás operando por {estado.agente_operado}
      <button disabled={saliendo} onClick={salir}>{saliendo ? "Saliendo…" : "Salir"}</button>
    </div>
  );
}

function OperadorSelector({ onClose }) {
  const [opciones, setOpciones] = useStateOP(null);
  const [entrando, setEntrando] = useStateOP(null);
  const [error, setError] = useStateOP(null);

  useEffectOP(() => {
    window.CRM_API.get("/operador/estado").then((r) => setOpciones(r.opciones || [])).catch(() => setOpciones([]));
  }, []);

  async function entrar(key) {
    setEntrando(key);
    setError(null);
    try {
      await window.CRM_API.post("/operador/entrar", { agente_key: key });
      window.location.reload();
    } catch (e) {
      setError(e.message);
      setEntrando(null);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="m-kicker">Modo operador</div>
        <h2>Operar como…</h2>
        {opciones === null && <p className="tq-muted">Cargando…</p>}
        {opciones && opciones.length === 0 && (
          <div className="club-vacio"><p>Todavía no hay ningún agente habilitado para que operes por él.</p></div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {opciones && opciones.map((o) => (
            <button key={o.key} className="club-btn-secundario" disabled={entrando === o.key} onClick={() => entrar(o.key)}>
              {entrando === o.key ? "Entrando…" : o.nombre}
            </button>
          ))}
        </div>
        {error && <p className="tq-error" style={{ marginTop: 10 }}>{error}</p>}
        <div className="modal-actions"><button className="cancel" onClick={onClose}>Cerrar</button></div>
      </div>
    </div>
  );
}

Object.assign(window, { OperadorBanner, OperadorSelector });
