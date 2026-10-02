// CLIENTE VOTA — el agente arma una selección de propiedades para un cliente
// puntual y le manda un link público (sin login) para que vote 👍/👎 cada una
// desde el celular. Acá se arma esa selección y se ven los resultados.
const { useState: useStateS, useEffect: useEffectS } = React;

function itemVacio() {
  return { titulo: '', precio: '', m2: '', ambientes: '', barrio: '', imagen_url: '', url_original: '' };
}

function Selecciones() {
  const [lista, setLista]   = useStateS([]);
  const [cargando, setCargando] = useStateS(true);
  const [error, setError]   = useStateS(null);
  const [nuevaOpen, setNuevaOpen] = useStateS(false);
  const [clienteNombre, setClienteNombre] = useStateS('');
  const [items, setItems]   = useStateS([itemVacio()]);
  const [guardando, setGuardando] = useStateS(false);
  const [linkNuevo, setLinkNuevo] = useStateS(null);
  const [copiadoId, setCopiadoId] = useStateS(null);

  function cargar() {
    if (!window.CRM_API) return;
    setCargando(true);
    window.CRM_API.get('/selecciones').then((r) => { setLista(r); setCargando(false); }).catch((e) => { setError(e.message); setCargando(false); });
  }
  useEffectS(cargar, []);

  function actualizarItem(i, campo, valor) {
    setItems((arr) => arr.map((it, idx) => idx === i ? { ...it, [campo]: valor } : it));
  }
  function agregarItem() { setItems((arr) => [...arr, itemVacio()]); }
  function quitarItem(i) { setItems((arr) => arr.length <= 1 ? arr : arr.filter((_, idx) => idx !== i)); }

  function resetForm() {
    setClienteNombre(''); setItems([itemVacio()]); setNuevaOpen(false);
  }

  async function crear() {
    const nombre = clienteNombre.trim();
    const validos = items
      .filter((it) => it.titulo.trim())
      .map((it) => ({
        ...it,
        m2: it.m2 ? parseFloat(it.m2) : null,
        ambientes: it.ambientes ? parseFloat(it.ambientes) : null,
      }));
    if (!nombre || validos.length === 0) return;
    setGuardando(true);
    try {
      const r = await window.CRM_API.post('/selecciones', { cliente_nombre: nombre, items: validos });
      setLinkNuevo(r.url);
      resetForm();
      cargar();
    } catch (e) {
      alert('No se pudo crear la selección: ' + e.message);
    }
    setGuardando(false);
  }

  function borrar(id) {
    if (!confirm('¿Eliminar esta selección? El link dejará de funcionar.')) return;
    setLista((l) => l.filter((s) => s.id !== id));
    if (window.CRM_API) window.CRM_API.delete('/selecciones/' + id).catch(() => {});
  }

  function copiar(url, id) {
    navigator.clipboard.writeText(url).then(() => { setCopiadoId(id); setTimeout(() => setCopiadoId(null), 1800); });
  }

  if (cargando) return <div className="tq-wrap"><p className="tq-muted">Cargando selecciones…</p></div>;
  if (error) return <div className="tq-wrap"><p className="tq-error">No se pudo cargar: {error}</p></div>;

  return (
    <div className="sel-wrap fade-in">
      <div className="sel-head">
        <h1>Cliente vota</h1>
        <p className="tq-muted">Armá una selección de propiedades para un cliente y mandale el link — vota 👍/👎 desde el celular, sin necesidad de llamarlo.</p>
      </div>

      <div className="sel-nueva">
        <button className="camp-nueva-btn" onClick={() => { setNuevaOpen(!nuevaOpen); setLinkNuevo(null); }}>
          {nuevaOpen ? '✕ Cancelar' : '+ Nueva selección'}
        </button>

        {nuevaOpen && (
          <div className="sel-form">
            <input
              className="camp-nueva-input"
              placeholder="Nombre del cliente · ej: Martina Gómez"
              value={clienteNombre}
              onChange={(e) => setClienteNombre(e.target.value)}
            />
            <div className="sel-items">
              {items.map((it, i) => (
                <div className="sel-item-row" key={i}>
                  <div className="sel-item-grid">
                    <input className="camp-nueva-input" placeholder="Título · ej: 3 amb en Palermo" value={it.titulo} onChange={(e) => actualizarItem(i, 'titulo', e.target.value)} />
                    <input className="camp-nueva-input" placeholder="Precio · ej: USD 189.000" value={it.precio} onChange={(e) => actualizarItem(i, 'precio', e.target.value)} />
                    <input className="camp-nueva-input" placeholder="m²" value={it.m2} onChange={(e) => actualizarItem(i, 'm2', e.target.value)} />
                    <input className="camp-nueva-input" placeholder="Ambientes" value={it.ambientes} onChange={(e) => actualizarItem(i, 'ambientes', e.target.value)} />
                    <input className="camp-nueva-input" placeholder="Barrio" value={it.barrio} onChange={(e) => actualizarItem(i, 'barrio', e.target.value)} />
                    <input className="camp-nueva-input" placeholder="Link de la publicación (opcional)" value={it.url_original} onChange={(e) => actualizarItem(i, 'url_original', e.target.value)} />
                    <input className="camp-nueva-input sel-item-full" placeholder="URL de una foto (opcional)" value={it.imagen_url} onChange={(e) => actualizarItem(i, 'imagen_url', e.target.value)} />
                  </div>
                  {items.length > 1 && <button className="camp-guardada-del" onClick={() => quitarItem(i)} title="Quitar propiedad">✕</button>}
                </div>
              ))}
            </div>
            <button className="cola-skip" style={{ alignSelf: 'flex-start' }} onClick={agregarItem}>+ Agregar otra propiedad</button>
            <button
              className="camp-start"
              style={{ marginTop: 8 }}
              disabled={!clienteNombre.trim() || !items.some((it) => it.titulo.trim()) || guardando}
              onClick={crear}
            >
              {guardando ? 'Creando…' : 'Crear y generar link'}
            </button>
          </div>
        )}

        {linkNuevo && (
          <div className="sel-link-nuevo">
            <span>✓ Selección creada — mandale este link al cliente:</span>
            <div className="sel-link-row">
              <input className="camp-nueva-input" readOnly value={linkNuevo} onClick={(e) => e.target.select()} />
              <button className="camp-agenda-btn" onClick={() => copiar(linkNuevo, 'nuevo')}>{copiadoId === 'nuevo' ? '✓ Copiado' : 'Copiar'}</button>
            </div>
          </div>
        )}
      </div>

      <div className="sel-lista">
        {lista.length === 0 && <p className="tq-muted">Todavía no armaste ninguna selección.</p>}
        {lista.map((s) => {
          const itemsS = s.seleccion_items || [];
          const likes = itemsS.filter((it) => it.voto === 'like').length;
          const dislikes = itemsS.filter((it) => it.voto === 'dislike').length;
          const url = location.origin + '/seleccion/' + s.token;
          return (
            <div className="sel-card" key={s.id}>
              <div className="sel-card-top">
                <div>
                  <div className="sel-card-nombre">{s.cliente_nombre}</div>
                  <div className="tq-muted" style={{ fontSize: 11.5 }}>{itemsS.length} propiedad{itemsS.length === 1 ? '' : 'es'} · {new Date(s.created_at).toLocaleDateString('es-AR')}</div>
                </div>
                <div className="sel-card-votos">
                  <span className="sel-tally sel-tally-like">👍 {likes}</span>
                  <span className="sel-tally sel-tally-dislike">👎 {dislikes}</span>
                </div>
              </div>
              <div className="sel-card-items">
                {itemsS.map((it) => (
                  <div className="sel-card-item" key={it.id}>
                    <span className="sel-item-voto">{it.voto === 'like' ? '👍' : it.voto === 'dislike' ? '👎' : '⏳'}</span>
                    <span className="sel-item-titulo">{it.titulo}</span>
                  </div>
                ))}
              </div>
              <div className="sel-card-actions">
                <button className="camp-agenda-btn" onClick={() => copiar(url, s.id)}>{copiadoId === s.id ? '✓ Copiado' : 'Copiar link'}</button>
                <button className="cola-skip" onClick={() => window.open(url, '_blank')}>Ver como cliente</button>
                <button className="camp-guardada-del" onClick={() => borrar(s.id)} title="Eliminar">✕</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

Object.assign(window, { Selecciones });
