// AGENTE IA — pantalla propia, conversación protagonista + acciones rápidas.
// Asistente de captación: redacta mensajes, genera ACM con comparables del
// mercado, responde objeciones y ayuda a convertir visitas. Respuestas
// simuladas (mockup interactivo). Loaded after components.jsx.
const { useState: useStateIA, useEffect: useEffectIA, useRef: useRefIA } = React;

const IA_ACTIONS = [
  { key: "redactar", icon: "message", title: "Redactar mensaje", sub: "WhatsApp o email, listos para enviar" },
  { key: "acm", icon: "chart", title: "Generar ACM", sub: "Tasación con comparables del mercado" },
  { key: "objecion", icon: "shield", title: "Responder objeción", sub: "“Ya tengo quien me lleva”, y más" },
  { key: "visita", icon: "deal", title: "Convertir visita", sub: "Argumentos para cerrar el mandato" },
];

function pesos(n) { return "US$ " + n.toLocaleString("es-AR"); }

// Canned, realistic assistant responses for the mockup.
function respuestaIA(kind, data) {
  if (kind === "redactar") {
    return {
      type: "mensaje",
      texto: "Hola! ¿Cómo estás? Vi que publicaste tu departamento y quería ponerme a disposición. Trabajo la zona hace años y tengo compradores buscando justo en tu edificio. ¿Te parece si coordinamos una visita corta esta semana para asesorarte sin compromiso?",
      nota: "Tono cordial, sin presión, pensado para un propietario que publica por su cuenta (FSBO).",
    };
  }
  if (kind === "objecion") {
    return {
      type: "texto",
      titulo: "Cuando te dicen “ya tengo quien me lleva”",
      bullets: [
        "Reconocé y no confrontes: “Me parece perfecto que ya estés trabajando con alguien.”",
        "Diferenciá con valor: “¿Te están mostrando comparables reales de la zona y un plan de difusión?”",
        "Ofrecé una segunda opinión sin costo: “Te puedo hacer una tasación gratuita para que tengas un segundo número.”",
        "Cerrá con bajo compromiso: “Si te sirve, lo charlamos 10 minutos y vos decidís.”",
      ],
    };
  }
  if (kind === "visita") {
    return {
      type: "texto",
      titulo: "Para convertir la visita en mandato",
      bullets: [
        "Mostrá datos, no opiniones: llevá el ACM impreso con 3 comparables.",
        "Hablá de tiempos: “Las propiedades bien publicadas se venden en X días en esta zona.”",
        "Plan concreto: difusión, fotos profesionales, filtro de interesados.",
        "Pedí el mandato con una fecha: “¿Arrancamos esta semana así no perdés la temporada?”",
      ],
    };
  }
  return { type: "texto", titulo: "Decime en qué te ayudo", bullets: ["Puedo redactar un mensaje, generar una tasación (ACM) o prepararte argumentos para una reunión."] };
}

function AgenteIA({ data, onWhatsapp }) {
  const [messages, setMessages] = useStateIA([{ role: "assistant", type: "welcome" }]);
  const [input, setInput] = useStateIA("");
  const [typing, setTyping] = useStateIA(false);
  const [acmOpen, setAcmOpen] = useStateIA(false);
  const scrollRef = useRefIA(null);

  useEffectIA(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, typing]);

  function push(msg) { setMessages((m) => [...m, msg]); }

  function pedir(userText, kind) {
    push({ role: "user", type: "texto", texto: userText });
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      push({ role: "assistant", ...respuestaIA(kind, data) });
    }, 1100);
  }

  function onAction(a) {
    if (a.key === "acm") { setAcmOpen(true); return; }
    const labels = {
      redactar: "Redactame un mensaje para un propietario que publica por su cuenta.",
      objecion: "¿Cómo respondo cuando me dicen que ya tienen otro agente?",
      visita: "Dame argumentos para cerrar el mandato en la próxima visita.",
    };
    pedir(labels[a.key], a.key);
  }

  function enviar() {
    const t = input.trim();
    if (!t) return;
    setInput("");
    pedir(t, "generico");
  }

  function generarACM(form) {
    setAcmOpen(false);
    const barrio = form.barrio || "la zona";
    push({ role: "user", type: "texto", texto: `Generá un ACM para un ${form.tipo.toLowerCase()} en ${barrio}, ${form.ambientes || "3"} ambientes, ${form.m2 || "65"} m².` });
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      const comps = data.comparables;
      const prom = Math.round(comps.reduce((s, c) => s + c.precio / c.m2, 0) / comps.length);
      const m2 = parseInt(form.m2, 10) || 65;
      const sugerido = prom * m2;
      push({
        role: "assistant",
        type: "acm",
        barrio,
        m2,
        rango: [Math.round(sugerido * 0.95 / 1000) * 1000, Math.round(sugerido * 1.06 / 1000) * 1000],
        m2valor: prom,
        comps,
      });
    }, 1400);
  }

  return (
    <div className="ia-screen fade-in">
      <div className="ia-convo" ref={scrollRef}>
        <div className="ia-inner">
          {messages.map((m, i) => <IAMessage key={i} m={m} data={data} onWhatsapp={onWhatsapp} onAction={onAction} onACM={() => setAcmOpen(true)} />)}
          {typing && (
            <div className="ia-row assistant">
              <div className="ia-ava"><Icon.spark /></div>
              <div className="ia-bubble ia-typing"><span></span><span></span><span></span></div>
            </div>
          )}
        </div>
      </div>

      <div className="ia-composer">
        <div className="ia-composer-inner">
          <button className="ia-chip" onClick={() => setAcmOpen(true)}><Icon.chart /> ACM</button>
          <input
            className="ia-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
            placeholder="Preguntame algo o pedime un mensaje…"
          />
          <button className="ia-send" onClick={enviar} aria-label="Enviar"><Icon.send /></button>
        </div>
        <p className="ia-foot">Datos de mercado reales de Zonaprop · Enter para enviar</p>
      </div>

      {acmOpen && <ACMForm data={data} onClose={() => setAcmOpen(false)} onGenerar={generarACM} />}
    </div>
  );
}

function IAMessage({ m, data, onWhatsapp, onAction, onACM }) {
  if (m.role === "user") {
    return <div className="ia-row user"><div className="ia-bubble user">{m.texto}</div></div>;
  }
  // assistant
  if (m.type === "welcome") {
    return (
      <div className="ia-welcome">
        <div className="ia-hero-ava"><Icon.spark /></div>
        <h1>Hola, {data.agente}.</h1>
        <p>Soy tu asistente de captación. Redacto mensajes, te preparo argumentos para conseguir mandatos y genero tasaciones (ACM) con datos reales del mercado.</p>
        <div className="ia-actions-grid">
          {IA_ACTIONS.map((a) => (
            <button className="ia-action" key={a.key} onClick={() => onAction(a)}>
              <span className="ia-action-ic">{Icon[a.icon] ? Icon[a.icon]() : null}</span>
              <span className="ia-action-tx">
                <b>{a.title}</b>
                <small>{a.sub}</small>
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="ia-row assistant">
      <div className="ia-ava"><Icon.spark /></div>
      <div className="ia-bubble">
        {m.type === "mensaje" && (
          <div>
            <div className="ia-draft">{m.texto}</div>
            {m.nota && <p className="ia-note">{m.nota}</p>}
            <div className="ia-draft-actions">
              <button className="ia-btn-copy" onClick={() => { if (navigator.clipboard) navigator.clipboard.writeText(m.texto).catch(() => {}); }}><Icon.copy /> Copiar</button>
              <button className="ia-btn-wa" onClick={() => onWhatsapp({ nombre: "el contacto", telefono: "", mensaje: m.texto })}><Icon.wa /> Enviar por WhatsApp</button>
            </div>
          </div>
        )}
        {m.type === "texto" && (
          <div>
            {m.titulo && <div className="ia-title">{m.titulo}</div>}
            {m.texto && <p className="ia-p">{m.texto}</p>}
            {m.bullets && <ul className="ia-list">{m.bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>}
          </div>
        )}
        {m.type === "acm" && <ACMResult m={m} />}
      </div>
    </div>
  );
}

function ACMResult({ m }) {
  return (
    <div className="acm-result">
      <div className="acm-kicker"><Icon.chart /> Tasación sugerida · {m.barrio}</div>
      <div className="acm-price">{pesos(m.rango[0])} – {pesos(m.rango[1])}</div>
      <div className="acm-perm2">≈ {pesos(m.m2valor)} / m² · {m.m2} m²</div>
      <div className="acm-comps-label">Comparables del mercado</div>
      <div className="acm-comps">
        {m.comps.map((c, i) => (
          <div className="acm-comp" key={i}>
            <div className="acm-comp-main">
              <div className="acm-comp-dir">{c.dir}</div>
              <div className="acm-comp-meta">{c.amb} amb · {c.m2} m²</div>
            </div>
            <div className="acm-comp-right">
              <div className="acm-comp-price">{pesos(c.precio)}</div>
              <span className={"acm-tag" + (c.estado === "Vendido" ? " vendido" : "")}>{c.estado}</span>
            </div>
          </div>
        ))}
      </div>
      <p className="ia-note">Estimación orientativa según publicaciones y cierres recientes de la zona. Datos de Zonaprop.</p>
    </div>
  );
}

function ACMForm({ data, onClose, onGenerar }) {
  const [f, setF] = useStateIA({ barrio: "", direccion: "", tipo: "Departamento", m2: "", ambientes: "", cubiertos: "", descubiertos: "", antiguedad: "", amenities: "" });
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  useEffectIA(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal acm-modal" onClick={(e) => e.stopPropagation()}>
        <button className="drawer-close" onClick={onClose} aria-label="Cerrar"><Icon.x /></button>
        <div className="m-kicker">Agente IA</div>
        <h2>Generar tasación (ACM)</h2>
        <p className="acm-form-lead">Completá lo que tengas. Con el barrio, los m² y los ambientes ya te doy un número; el resto afina el resultado.</p>

        <div className="acm-group">
          <div className="acm-group-label"><Icon.home /> Ubicación</div>
          <div className="field-row">
            <div className="field"><label>Barrio</label><input value={f.barrio} onChange={set("barrio")} placeholder="Ej: Colegiales" autoFocus /></div>
            <div className="field"><label>Dirección <span className="opt">· opcional</span></label><input value={f.direccion} onChange={set("direccion")} placeholder="Av. Federico Lacroze 2400" /></div>
          </div>
        </div>

        <div className="acm-group">
          <div className="acm-group-label"><Icon.building /> Propiedad</div>
          <div className="acm-grid3">
            <div className="field"><label>Tipo</label><select value={f.tipo} onChange={set("tipo")}><option>Departamento</option><option>PH</option><option>Casa</option><option>Local</option></select></div>
            <div className="field"><label>Ambientes</label><input value={f.ambientes} onChange={set("ambientes")} placeholder="3" /></div>
            <div className="field"><label>Antigüedad <span className="opt">· años</span></label><input value={f.antiguedad} onChange={set("antiguedad")} placeholder="30" /></div>
          </div>
        </div>

        <div className="acm-group">
          <div className="acm-group-label"><Icon.chart /> Superficie</div>
          <div className="acm-grid3">
            <div className="field"><label>Total m²</label><input value={f.m2} onChange={set("m2")} placeholder="65" /></div>
            <div className="field"><label>Cubiertos m²</label><input value={f.cubiertos} onChange={set("cubiertos")} placeholder="58" /></div>
            <div className="field"><label>Descubiertos m²</label><input value={f.descubiertos} onChange={set("descubiertos")} placeholder="7" /></div>
          </div>
        </div>

        <div className="field">
          <label>Amenities <span className="opt">· opcional</span></label>
          <input value={f.amenities} onChange={set("amenities")} placeholder="Pileta, gym, SUM, cochera…" />
        </div>

        <div className="modal-actions">
          <button className="save" onClick={() => onGenerar(f)}><Icon.chart /> Generar ACM</button>
          <button className="cancel" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { AgenteIA });
