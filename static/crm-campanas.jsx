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

// WhatsApp (wa.me) solo permite precargar texto, nunca una imagen — no existe
// forma de que una página web la adjunte sola al chat. Por eso la bajamos al
// dispositivo del agente: queda en Descargas/Galería, lista para adjuntar en
// un toque desde el selector de archivos de WhatsApp.
function descargarImagen(dataUrl, titulo) {
  if (!dataUrl) return;
  const ext = (dataUrl.match(/^data:image\/(\w+);/) || [])[1] || 'jpg';
  const nombre = 'flyer-' + (titulo || 'campana').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '.' + ext;
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function Campanas({ data, onWhatsapp }) {
  const camp = data.campanas;
  const [enviando,    setEnviando]    = useStateC(null);
  const [nuevaOpen,   setNuevaOpen]   = useStateC(false);
  const [nuevaTitulo, setNuevaTitulo] = useStateC('');
  const [nuevaMensaje,setNuevaMensaje]= useStateC('');
  const [nuevaImagen, setNuevaImagen] = useStateC(null);
  const [guardando,   setGuardando]   = useStateC(false);
  // Campañas propias ya guardadas — antes se perdían si no se enviaban en
  // el momento; ahora quedan acá disponibles hasta que el agente las borre.
  const [guardadas,   setGuardadas]   = useStateC([]);
  // Edición in-line de una campaña guardada — id de la que está en edición
  // más un borrador separado, así tocar los inputs no toca la lista real
  // hasta que se confirma "Guardar".
  // OJO: estos hooks tienen que declararse ACÁ, antes del "if (enviando)
  // return ..." de más abajo — React exige que todos los hooks de un
  // componente se llamen siempre en el mismo orden, en cada render. Ponerlos
  // después de un return condicional (como estaban antes) hacía que, al
  // entrar a enviar una campaña, se saltearan esos 5 hooks y React tirara
  // "Rendered fewer hooks than expected" — toda la pantalla se caía en blanco.
  const [editandoId, setEditandoId] = useStateC(null);
  const [editTitulo, setEditTitulo] = useStateC('');
  const [editMensaje,setEditMensaje]= useStateC('');
  const [editImagen, setEditImagen] = useStateC(null);
  const [editGuardando, setEditGuardando] = useStateC(false);

  useEffectC(() => {
    if (!window.CRM_API) return;
    window.CRM_API.get('/campanas').then(setGuardadas).catch(() => {});
  }, []);

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

  async function lanzarNueva() {
    const titulo = nuevaTitulo.trim();
    const mensaje = nuevaMensaje.trim();
    if (!titulo || !mensaje) return;
    setGuardando(true);
    let guardada = { id: 'custom-' + Date.now(), titulo, mensaje, imagen: nuevaImagen || null };
    try {
      if (window.CRM_API) {
        guardada = await window.CRM_API.post('/campanas', { titulo, mensaje, imagen: nuevaImagen || null });
        setGuardadas(g => [guardada, ...g]);
      }
    } catch (e) {
      console.error('No se pudo guardar la campaña, se envía igual sin guardar:', e);
    }
    setGuardando(false);
    setNuevaOpen(false);
    setNuevaTitulo('');
    setNuevaMensaje('');
    setNuevaImagen(null);
    setEnviando({ ...guardada, alcance: data.carteraQueue.length });
  }

  async function borrarGuardada(id) {
    setGuardadas(g => g.filter(c => c.id !== id));
    if (window.CRM_API) window.CRM_API.delete('/campanas/' + id).catch(() => {});
  }

  function empezarEdicion(g) {
    setEditandoId(g.id);
    setEditTitulo(g.titulo);
    setEditMensaje(g.mensaje);
    setEditImagen(g.imagen || null);
  }
  function cancelarEdicion() { setEditandoId(null); }
  function onEditImagenSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setEditImagen(ev.target.result);
    reader.readAsDataURL(file);
  }
  async function guardarEdicion(id) {
    const titulo = editTitulo.trim();
    const mensaje = editMensaje.trim();
    if (!titulo || !mensaje) return;
    setEditGuardando(true);
    const cambios = { titulo, mensaje, imagen: editImagen || null };
    try {
      if (window.CRM_API) await window.CRM_API.put('/campanas/' + id, cambios);
      setGuardadas(g => g.map(c => c.id === id ? { ...c, ...cambios } : c));
      setEditandoId(null);
    } catch (e) {
      console.error('No se pudo guardar la edición:', e);
      alert('No se pudo guardar el cambio. Probá de nuevo.');
    }
    setEditGuardando(false);
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
              disabled={!nuevaTitulo.trim() || !nuevaMensaje.trim() || guardando}
              onClick={lanzarNueva}
            >
              {guardando ? 'Guardando…' : <>Empezar a enviar <Icon.arrow /></>}
            </button>
          </div>
        )}
      </div>

      {/* Campañas guardadas — quedan acá aunque no se hayan enviado en el momento */}
      {guardadas.length > 0 && (
        <div className="camp-agenda">
          <div className="camp-agenda-label">Tus campañas guardadas</div>
          <div className="camp-agenda-list">
            {guardadas.map((g) => (
              editandoId === g.id ? (
                <div className="camp-nueva-form camp-guardada-edit" key={g.id}>
                  <input
                    className="camp-nueva-input"
                    placeholder="Título"
                    value={editTitulo}
                    onChange={e => setEditTitulo(e.target.value)}
                  />
                  <textarea
                    className="camp-nueva-textarea"
                    placeholder="Mensaje · usá NOMBRE para personalizar"
                    value={editMensaje}
                    onChange={e => setEditMensaje(e.target.value)}
                    rows={3}
                  />
                  <div className="camp-nueva-img-row">
                    <label className="camp-nueva-img-label">
                      {editImagen
                        ? <img src={editImagen} className="camp-nueva-img-preview" alt="flyer" />
                        : <span>+ Agregar imagen <span style={{fontWeight:400,opacity:.6}}>(opcional)</span></span>
                      }
                      <input type="file" accept="image/*" style={{display:'none'}} onChange={onEditImagenSelect} />
                    </label>
                    {editImagen && (
                      <button className="camp-nueva-img-remove" onClick={() => setEditImagen(null)}>✕ Quitar</button>
                    )}
                  </div>
                  <div className="camp-guardada-edit-actions">
                    <button className="cola-skip" onClick={cancelarEdicion}>Cancelar</button>
                    <button
                      className="camp-start"
                      disabled={!editTitulo.trim() || !editMensaje.trim() || editGuardando}
                      onClick={() => guardarEdicion(g.id)}
                    >
                      {editGuardando ? 'Guardando…' : 'Guardar cambios'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="camp-agenda-row" key={g.id}>
                  {g.imagen
                    ? <img src={g.imagen} className="camp-guardada-thumb" alt="" />
                    : <div className="camp-cal"><span className="camp-cal-d">✉</span></div>
                  }
                  <div className="camp-agenda-id">
                    <div className="camp-agenda-title">{g.titulo}</div>
                    <div className="camp-agenda-sub">{g.mensaje}</div>
                  </div>
                  <button className="camp-guardada-edit-btn" onClick={() => empezarEdicion(g)} title="Editar">✏</button>
                  <button className="camp-agenda-btn" onClick={() => setEnviando({ ...g, alcance: data.carteraQueue.length })}>
                    Enviar
                  </button>
                  <button className="camp-guardada-del" onClick={() => borrarGuardada(g.id)} title="Eliminar">✕</button>
                </div>
              )
            ))}
          </div>
        </div>
      )}

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
  const [saltados, setSaltados] = useStateC({});
  const [idx, setIdx] = useStateC(0);
  const [busqueda, setBusqueda] = useStateC("");
  const hechos = Object.keys(enviados).length;
  const p = queue[idx];
  // Ojo con esto: los navegadores (sobre todo en el celular) solo dejan
  // disparar una descarga si pasa DENTRO de un click real del usuario — un
  // useEffect al montar no cuenta como gesto y la bajaba en silencio, sin
  // avisar. Por eso ahora se descarga recién en el primer "Enviar y seguir"
  // (una sola vez por campaña, no una por cada contacto).
  const [imgDescargada, setImgDescargada] = useStateC(false);

  function enviarYSeguir() {
    // La descarga del flyer NO va acá adentro: en algunas compus (con
    // "Preguntar dónde guardar cada archivo" activado en el navegador) dispara
    // un cuadro nativo de "Guardar como" que bloquea toda la página hasta que
    // se cierra — y como quedaba atrás de otra ventana, parecía que el botón
    // de enviar se colgaba. Ahora la descarga es 100% manual, con su botón.
    const msg = getMensaje(campana, p.nombre);
    onWhatsapp({ nombre: p.nombre, telefono: p.telefono, mensaje: msg });
    setEnviados((e) => ({ ...e, [p.id]: true }));
    setSaltados((s) => { if (!s[p.id]) return s; const n = { ...s }; delete n[p.id]; return n; });
    setIdx((i) => i + 1);
  }
  function saltar() {
    setSaltados((s) => ({ ...s, [p.id]: true }));
    setIdx((i) => i + 1);
  }
  function irA(i) { setIdx(i); setBusqueda(""); }

  const pendientes = queue.filter((c) => saltados[c.id] && !enviados[c.id]);
  const finCola = idx >= queue.length;
  const pct = Math.round((hechos / queue.length) * 100);

  const resultados = busqueda.trim().length >= 2
    ? queue
        .map((c, i) => ({ ...c, _i: i }))
        .filter((c) => c.nombre.toLowerCase().includes(busqueda.trim().toLowerCase()))
        .slice(0, 6)
    : [];

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

      <div className="cola-buscar">
        <input
          type="text"
          className="cola-buscar-input"
          placeholder="¿Se te pasó alguien? Buscalo por nombre…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        {resultados.length > 0 && (
          <div className="cola-buscar-resultados">
            {resultados.map((r) => (
              <button key={r.id} className="cola-buscar-item" onClick={() => irA(r._i)}>
                <span>{r.nombre}</span>
                {enviados[r.id] && <span className="cola-buscar-tag">ya enviado</span>}
                {saltados[r.id] && !enviados[r.id] && <span className="cola-buscar-tag cola-buscar-tag-pend">salteado</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {finCola ? (
        pendientes.length > 0 ? (
          <div className="cola-pendientes">
            <h2>Te quedaron {pendientes.length} salteados</h2>
            <p>Revisalos y enviales el saludo si querés.</p>
            {pendientes.map((c) => (
              <div className="cola-pend-item" key={c.id}>
                <Avatar iniciales={c.iniciales} />
                <div className="cola-pend-info">
                  <div className="cola-name">{c.nombre}</div>
                  <div className="cola-phone">+54 {c.telefono}</div>
                </div>
                <button className="cola-pend-btn" onClick={() => irA(queue.findIndex((x) => x.id === c.id))}>Revisar</button>
              </div>
            ))}
            <button className="btn-primary-lg" style={{ maxWidth: 280, margin: "16px auto 0" }} onClick={onSalir}>Volver a Campañas</button>
          </div>
        ) : (
          <div className="all-done">
            <h2>Tanda completa</h2>
            <p>Enviaste el saludo de {campana.titulo} a este grupo. Podés seguir con el resto de tu cartera cuando quieras.</p>
            <button className="btn-primary-lg" style={{ maxWidth: 280, margin: "0 auto" }} onClick={onSalir}>Volver a Campañas</button>
          </div>
        )
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
              <div className="cola-img-hint">
                {imgDescargada
                  ? "Ya la descargaste — adjuntala en WhatsApp desde tu carpeta de Descargas"
                  : "Antes de empezar: tocá \"Descargar imagen\" y adjuntala en WhatsApp con el clip 📎 en cada envío"}
              </div>
              <button
                className={"cola-img-download-btn" + (imgDescargada ? "" : " cola-img-download-btn-pending")}
                onClick={() => { descargarImagen(campana.imagen, campana.titulo); setImgDescargada(true); }}
              >
                ⬇ {imgDescargada ? "Descargar de nuevo" : "Descargar imagen"}
              </button>
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
