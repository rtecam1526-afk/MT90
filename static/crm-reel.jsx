// GENERAR REEL — arma un video vertical (Reels/TikTok/Stories) a partir de
// fotos de una propiedad + precio/specs. Primer prototipo: carga manual de
// fotos (se comprimen en el navegador antes de mandar, para que el video
// se genere rápido) + autocompletar precio/m²/ambientes pegando un link,
// reusando el mismo buscador puntual que ya usa "Cliente vota".
const { useState: useStateR } = React;

function downscaleImagen(file, maxDim, calidad) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('No se pudo leer la imagen'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) { height = Math.round(height * maxDim / width); width = maxDim; }
          else { width = Math.round(width * maxDim / height); height = maxDim; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', calidad));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function ReelModal({ onClose }) {
  const [fotos, setFotos] = useStateR([]); // [{id, dataUrl}]
  const [subiendo, setSubiendo] = useStateR(false);
  const [link, setLink] = useStateR('');
  const [buscandoLink, setBuscandoLink] = useStateR(false);
  const [precio, setPrecio] = useStateR('');
  const [m2, setM2] = useStateR('');
  const [ambientes, setAmbientes] = useStateR('');
  const [barrio, setBarrio] = useStateR('');
  const [generando, setGenerando] = useStateR(false);
  const [error, setError] = useStateR(null);
  const [videoUrl, setVideoUrl] = useStateR(null);

  async function onFotosSelect(e) {
    const files = Array.from(e.target.files || []).slice(0, 8 - fotos.length);
    if (!files.length) return;
    setSubiendo(true);
    try {
      const nuevas = [];
      for (const file of files) {
        const dataUrl = await downscaleImagen(file, 1600, 0.82);
        nuevas.push({ id: Date.now() + '-' + Math.random(), dataUrl });
      }
      setFotos((f) => [...f, ...nuevas].slice(0, 8));
    } catch (e2) {
      setError('No se pudo procesar alguna foto: ' + e2.message);
    }
    setSubiendo(false);
    e.target.value = '';
  }

  function quitarFoto(id) { setFotos((f) => f.filter((x) => x.id !== id)); }

  async function autocompletarLink() {
    const url = link.trim();
    if (!url || !window.CRM_API) return;
    setBuscandoLink(true);
    setError(null);
    try {
      const info = await window.CRM_API.post('/selecciones/previsualizar', { url });
      if (info.precio) setPrecio(info.precio);
      if (info.m2 != null) setM2(String(info.m2));
      if (info.ambientes != null) setAmbientes(String(info.ambientes));
    } catch (e2) {
      setError('No se pudo autocompletar desde ese link — completá los campos a mano.');
    }
    setBuscandoLink(false);
  }

  async function generar() {
    if (fotos.length === 0) { setError('Agregá al menos una foto.'); return; }
    setGenerando(true);
    setError(null);
    setVideoUrl(null);
    try {
      const r = await fetch('/reel/generar', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          precio: precio.trim(),
          m2: m2.trim(),
          ambientes: ambientes.trim(),
          barrio: barrio.trim(),
          fotos: fotos.map((f) => f.dataUrl),
        }),
      });
      if (!r.ok) {
        const txt = await r.text();
        let msg = txt;
        try { msg = JSON.parse(txt).error || txt; } catch (e3) {}
        // DEBUG temporal: si el cuerpo vino vacío o sin "error", mostramos
        // igual el status HTTP para poder diagnosticar sin acceso a logs.
        throw new Error((msg && msg.trim()) ? msg : ('HTTP ' + r.status + ' (sin detalle en el cuerpo de la respuesta)'));
      }
      const blob = await r.blob();
      setVideoUrl(URL.createObjectURL(blob));
    } catch (e2) {
      setError('DEBUG: ' + (e2.message || ('Fallo de red: ' + (e2.name || 'desconocido'))));
    }
    setGenerando(false);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal reel-modal" onClick={(e) => e.stopPropagation()}>
        <button className="drawer-close" onClick={onClose} aria-label="Cerrar">✕</button>
        <div className="m-kicker">Prototipo</div>
        <h2>🎬 Generar reel</h2>
        <p className="acm-form-lead">Subí las fotos de la propiedad, completá precio y datos, y armamos un video vertical listo para Instagram/TikTok. Sin música — se la agregás vos al subirlo, para no pisar derechos de autor.</p>

        {!videoUrl && (
          <React.Fragment>
            <div className="reel-group-label">Link de la publicación <span className="opt">· opcional, autocompleta precio/m²/ambientes</span></div>
            <div className="sel-link-autocomp" style={{ marginBottom: 14 }}>
              <input className="camp-nueva-input" placeholder="Pegá el link de Zonaprop/ML/Argenprop…" value={link} onChange={(e) => setLink(e.target.value)} />
              <button type="button" className="cola-skip sel-autocomp-btn" disabled={!link.trim() || buscandoLink} onClick={autocompletarLink}>
                {buscandoLink ? 'Buscando…' : '🔍 Autocompletar'}
              </button>
            </div>

            <div className="reel-group-label">Fotos <span className="opt">· hasta 8, en el orden que van a aparecer</span></div>
            <div className="reel-fotos-grid">
              {fotos.map((f) => (
                <div className="reel-foto-thumb" key={f.id}>
                  <img src={f.dataUrl} alt="" />
                  <button type="button" className="reel-foto-del" onClick={() => quitarFoto(f.id)}>✕</button>
                </div>
              ))}
              {fotos.length < 8 && (
                <label className="reel-foto-add">
                  {subiendo ? '…' : '+ Agregar'}
                  <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={onFotosSelect} disabled={subiendo} />
                </label>
              )}
            </div>

            <div className="field-row" style={{ marginTop: 14 }}>
              <div className="field"><label>Precio</label><input value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder="USD 189.000" /></div>
              <div className="field"><label>Barrio</label><input value={barrio} onChange={(e) => setBarrio(e.target.value)} placeholder="Palermo" /></div>
            </div>
            <div className="field-row">
              <div className="field"><label>m²</label><input value={m2} onChange={(e) => setM2(e.target.value)} placeholder="65" /></div>
              <div className="field"><label>Ambientes</label><input value={ambientes} onChange={(e) => setAmbientes(e.target.value)} placeholder="3" /></div>
            </div>

            {error && <div className="sel-autocomp-error" style={{ marginTop: 10 }}>{error}</div>}

            <div className="modal-actions">
              <button className="save" disabled={generando || fotos.length === 0} onClick={generar}>
                {generando ? 'Generando… (puede tardar unos segundos)' : '🎬 Generar reel'}
              </button>
              <button className="cancel" onClick={onClose}>Cancelar</button>
            </div>
          </React.Fragment>
        )}

        {videoUrl && (
          <React.Fragment>
            <video src={videoUrl} controls autoPlay loop className="reel-preview-video" />
            <div className="modal-actions">
              <a className="save" href={videoUrl} download="reel-mt90.mp4" style={{ textDecoration: 'none', textAlign: 'center' }}>⬇ Descargar video</a>
              <button className="cancel" onClick={() => setVideoUrl(null)}>Hacer otro</button>
            </div>
          </React.Fragment>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { ReelModal });
