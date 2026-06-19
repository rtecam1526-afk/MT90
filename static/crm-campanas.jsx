// CAMPAÑAS / FECHAS ESPECIALES — saludos masivos enviados de a uno.
// La fecha próxima va destacada; el envío es una cola guiada: abre el chat
// de cada persona con el saludo cargado, el agente solo aprieta enviar.
const { useState: useStateC, useEffect: useEffectC, useRef: useRefC } = React;

const MESES_C = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
function fechaCampana(iso) {
  const [y, m, d] = iso.split("-");
  return parseInt(d, 10) + " de " + MESES_C[parseInt(m, 10) - 1];
}

function primerNombre(nombre) { return (nombre || '').split(' ')[0] || 'amigo/a'; }

function getMensaje(campana, nombre) {
  return (campana.mensaje || '').replace('NOMBRE', primerNombre(nombre));
}

function Campanas({ data, onWhatsapp }) {
  const camp = data.campanas;
  const [enviando,    setEnviando]    = useStateC(null);
  const [nuevaOpen,   setNuevaOpen]   = useStateC(false);
  const [nuevaTitulo, setNuevaTitulo] = useStateC('');
  const [nuevaMensaje,setNuevaMensaje]= useStateC('');
  const [nuevaImagen, setNuevaImagen] = useStateC(null);

  function onImagenSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setNuevaImagen(ev.target.result);
    reader.readAsDataURL(file);
  }

  if (enviando) {
    return <ColaEnvio data={data} campana={enviando} onWhatsapp={onWhatsapp} onSalir={() => setEnviando(null)} />;
  }

  function lanzarNueva() {
    if (!nuevaTitulo.trim() || !nuevaMensaje.trim()) return;
    setEnviando({
      id: 'custom',
      titulo: nuevaTitulo.trim(),
      mensaje: nuevaMensaje.trim(),
      imagen: nuevaImagen || null,
      alcance: data.carteraQueue.length,
    });
  }

  const prox = camp.proxima;
  const agente = data.agente || 'Gabriela';

  return (
    <div className="camp fade-in">
      <div className="camp-head">
        <h1>Fechas especiales</h1>
        <p>Un saludo a tiempo mantiene viva la relación. Yo te preparo el mensaje y te guío para enviarlo a tu cartera, uno por uno.</p>
      </div>

      {/* Nueva campaña personalizada */}
      <div className="camp-nueva">
        <button className="camp-nueva-btn" onClick={() => setNuevaOpen(!nuevaOpen)}>
          {nuevaOpen ? '✕ Cancelar' : '+ Nueva campaña'}
        </button>
        {nuevaOpen && (
          <div className="camp-nueva-form">
            <input
              className="camp-nueva-input"
              placeholder="Título · ej: Mundial 2026"
              value={nuevaTitulo}
              onChange={e => setNuevaTitulo(e.target.value)}
            />
            <textarea
              className="camp-nueva-textarea"
              placeholder={"Mensaje · usá NOMBRE para personalizar\nej: ¡Hola NOMBRE! ¿Ya tenés listo para ver los partidos? — " + agente}
              value={nuevaMensaje}
              onChange={e => setNuevaMensaje(e.target.value)}
              rows={3}
            />
            <div className="camp-nueva-img-row">
              <label className="camp-nueva-img-label">
                {nuevaImagen
                  ? <img src={nuevaImagen} className="camp-nueva-img-preview" alt="flyer" />
                  : <span>+ Agregar imagen <span style={{fontWeight:400,opacity:.6}}>(opcional)</span></span>
                }
                <input type="file" accept="image/*" style={{display:'none'}} onChange={onImagenSelect} />
              </label>
              {nuevaImagen && (
                <button className="camp-nueva-img-remove" onClick={() => setNuevaImagen(null)}>✕ Quitar</button>
              )}
            </div>
            <button
              className="camp-start"
              style={{ marginTop: 8 }}
              disabled={!nuevaTitulo.trim() || !nuevaMensaje.trim()}
              onClick={lanzarNueva}
            >
              Empezar a enviar <Icon.arrow />
            </button>
          </div>
        )}
      </div>

      {/* Próxima campaña destacada */}
      <div className="camp-feature">
        <div className="camp-feature-top">
          <span className="camp-when">En {prox.enDias} días · {fechaCampana(prox.fecha)}</span>
          <h2>{prox.titulo}</h2>
        </div>
        <div className="camp-msg-block">
          <div className="camp-msg-label">Saludo sugerido</div>
          <div className="camp-msg">{getMensaje(prox, '[nombre]')}</div>
        </div>
        <div className="camp-feature-foot">
          <div className="camp-reach">
            <Icon.users />
            <span>A tu cartera completa · <b>{prox.alcance.toLocaleString("es-AR")} contactos</b></span>
          </div>
          <button className="camp-start" onClick={() => setEnviando(prox)}>
            Empezar a enviar <Icon.arrow />
          </button>
        </div>
      </div>

      {/* Agenda de próximas fechas */}
      <div className="camp-agenda">
        <div className="camp-agenda-label">Más adelante este año</div>
        <div className="camp-agenda-list">
          {camp.agenda.map((a) => (
            <div className="camp-agenda-row" key={a.id}>
              <div className="camp-cal">
                <span className="camp-cal-d">{a.fecha.split("-")[2]}</span>
                <span className="camp-cal-m">{MESES_C[parseInt(a.fecha.split("-")[1], 10) - 1].slice(0, 3)}</span>
              </div>
              <div className="camp-agenda-id">
                <div className="camp-agenda-title">{a.titulo}</div>
                <div className="camp-agenda-sub">En {a.enDias} días</div>
              </div>
              <button className="camp-agenda-btn" onClick={() => setEnviando({ ...a, alcance: prox.alcance })}>
                Preparar
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- Cola de envío guiada ---------- */
function ColaEnvio({ data, campana, onWhatsapp, onSalir }) {
  const queue = data.carteraQueue;
  const total = campana.alcance;
  const [enviados, setEnviados] = useStateC({});
  const [idx, setIdx] = useStateC(0);
  const hechos = Object.keys(enviados).length;
  const p = queue[idx];

  function enviarYSeguir() {
    const msg = getMensaje(campana, p.nombre);
    onWhatsapp({ nombre: p.nombre, telefono: p.telefono, mensaje: msg });
    setEnviados((e) => ({ ...e, [p.id]: true }));
    setTimeout(() => { if (idx < queue.length - 1) setIdx(idx + 1); }, 250);
  }
  function saltar() { if (idx < queue.length - 1) setIdx(idx + 1); }

  const finCola = hechos >= queue.length;
  const pct = Math.round((hechos / queue.length) * 100);

  return (
    <div className="cola fade-in">
      <button className="cola-back" onClick={onSalir}><Icon.back /> Salir de la campaña</button>

      <div className="cola-bar">
        <div className="cola-bar-top">
          <span className="cola-camp">{campana.titulo}</span>
          <span className="cola-count"><b>{hechos}</b> enviados de {queue.length}</span>
        </div>
        <div className="cola-track"><div className="cola-fill" style={{ width: pct + "%" }}></div></div>
        <p className="cola-note">Enviás de a uno, sin spam.{queue.length < total ? ` ${total - queue.length} contacto${total - queue.length === 1 ? "" : "s"} de tu cartera no tiene teléfono cargado.` : ""}</p>
      </div>

      {finCola ? (
        <div className="all-done">
          <h2>Tanda completa</h2>
          <p>Enviaste el saludo de {campana.titulo} a este grupo. Podés seguir con el resto de tu cartera cuando quieras.</p>
          <button className="btn-primary-lg" style={{ maxWidth: 280, margin: "0 auto" }} onClick={onSalir}>Volver a Campañas</button>
        </div>
      ) : (
        <div className="cola-card" key={p.id}>
          <div className="cola-person">
            <Avatar iniciales={p.iniciales} />
            <div>
              <div className="cola-name">{p.nombre}</div>
              <div className="cola-phone">+54 {p.telefono}</div>
            </div>
            <span className="cola-pos">{idx + 1} / {queue.length}</span>
          </div>

          {campana.imagen && (
            <div className="cola-img-wrap">
              <img src={campana.imagen} className="cola-img" alt="flyer" />
              <div className="cola-img-hint">Adjuntá esta imagen en WhatsApp</div>
            </div>
          )}

          <div className="cola-msg-label">Se enviará</div>
          <div className="cola-msg">{getMensaje(campana, p.nombre)}</div>

          <div className="cola-actions">
            <button className="cola-skip" onClick={saltar}>Saltar</button>
            <button className="cola-send" onClick={enviarYSeguir}>
              <Icon.wa /> Enviar y seguir
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { Campanas });
