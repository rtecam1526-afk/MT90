// DIFUSIÓN — dashboard de competencia/velocidad por zona (datos reales del
// Radar, no estimaciones) + calculadora de reparto de presupuesto. Ayuda a
// decidir dónde conviene pautar y dónde no hace falta.
const { useState: useStateD, useEffect: useEffectD } = React;

function nivelColor(nivel) {
  if (nivel === 'alta' || nivel === 'lenta') return 'baja';
  if (nivel === 'media') return 'media';
  return 'buena';
}

var TIPO_ICONO = { departamentos: '🏢', casas: '🏠' };

// Antes salía una tarjeta por (barrio, tipo) — con una zona trabajando deptos
// Y casas, el mismo nombre de barrio aparecía dos veces seguidas y resultaba
// confuso ("¿por qué está repetido?"). Se agrupa por barrio en UNA tarjeta,
// con cada tipo como una columna propia adentro, bien marcada con ícono.
function agruparPorBarrio(zonas) {
  var porBarrio = {};
  zonas.forEach(function (z) {
    var key = z.barrio;
    if (!porBarrio[key]) porBarrio[key] = { barrio: z.barrio, tipos: {} };
    porBarrio[key].tipos[z.tipo_inmueble] = z;
  });
  return Object.values(porBarrio).sort(function (a, b) {
    var maxA = Math.max.apply(null, Object.values(a.tipos).map(function (t) { return t.cantidad_activas || 0; }));
    var maxB = Math.max.apply(null, Object.values(b.tipos).map(function (t) { return t.cantidad_activas || 0; }));
    return maxB - maxA;
  });
}

function Difusion() {
  const [zonas, setZonas] = useStateD(null);
  const [error, setError] = useStateD(null);
  const [presupuesto, setPresupuesto] = useStateD('');
  const [moneda, setMoneda] = useStateD('ARS');
  const [zonaSel, setZonaSel] = useStateD('');
  const [calculando, setCalculando] = useStateD(false);
  const [resultado, setResultado] = useStateD(null);
  const [errorCalc, setErrorCalc] = useStateD(null);
  const [pendientesDestaque, setPendientesDestaque] = useStateD([]);
  const [marcandoDestaque, setMarcandoDestaque] = useStateD(false);
  const [destaqueMarcado, setDestaqueMarcado] = useStateD(false);

  function cargarDestaques() {
    if (!window.CRM_API) return;
    window.CRM_API.get('/difusion/destaques').then((r) => setPendientesDestaque(r.pendientes || [])).catch(() => {});
  }

  useEffectD(() => {
    if (!window.CRM_API) return;
    window.CRM_API.get('/difusion/zonas').then((r) => {
      const zs = r.zonas || [];
      setZonas(zs);
      if (zs.length > 0) {
        const top = zs.slice().sort((a, b) => (b.cantidad_activas || 0) - (a.cantidad_activas || 0))[0];
        setZonaSel(top.barrio + '|' + top.tipo_inmueble);
      }
    }).catch((e) => setError(e.message));
    cargarDestaques();
  }, []);

  async function responderDestaque(id, funciono) {
    try {
      await window.CRM_API.post(`/difusion/destaque/${id}/feedback`, { funciono });
      setPendientesDestaque((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {}
  }

  async function marcarDestaque() {
    if (!resultado) return;
    setMarcandoDestaque(true);
    try {
      await window.CRM_API.post('/difusion/destaque', {
        barrio: resultado.zona_referencia.barrio,
        tipo_inmueble: resultado.zona_referencia.tipo_inmueble,
      });
      setDestaqueMarcado(true);
    } catch (e) {}
    setMarcandoDestaque(false);
  }

  async function calcular() {
    const monto = parseFloat(presupuesto);
    if (!monto || monto <= 0) return;
    setCalculando(true);
    setErrorCalc(null);
    setResultado(null);
    setDestaqueMarcado(false);
    try {
      const [barrio, tipo_inmueble] = zonaSel.split('|');
      const r = await window.CRM_API.post('/difusion/calculadora', { presupuesto: monto, moneda, barrio, tipo_inmueble });
      setResultado(r);
    } catch (e) {
      setErrorCalc(e.message);
    }
    setCalculando(false);
  }

  return (
    <div className="dif-wrap fade-in">
      <div className="dif-head">
        <h1>Difusión</h1>
        <p className="tq-muted">Competencia real de tus zonas (sacada del Radar) y dónde conviene poner tu presupuesto de pauta.</p>
      </div>

      {pendientesDestaque.length > 0 && (
        <div className="dif-destaque-pendientes">
          {pendientesDestaque.map((p) => (
            <div className="mb-banner mb-media" key={p.id}>
              <span className="mb-icon">🤔</span>
              <span className="mb-texto">
                Hace unos días marcaste que destacaste en <b>{(p.barrio || '').replace(/-/g, ' ')}</b> ({p.tipo_inmueble}) — ¿te generó más consultas?
              </span>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button className="camp-start" onClick={() => responderDestaque(p.id, true)}>Sí, sirvió</button>
                <button className="camp-start" style={{ background: '#ccc', color: '#333' }} onClick={() => responderDestaque(p.id, false)}>No sirvió</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="dif-section-title"><h3>Tus zonas, hoy</h3></div>
      {error && <p className="tq-error">No se pudo cargar: {error}</p>}
      {!error && zonas === null && <p className="tq-muted">Cargando…</p>}
      {zonas && zonas.length === 0 && (
        <p className="tq-muted">Todavía no hay datos — corré el Radar al menos una vez para ver la competencia de tus zonas acá.</p>
      )}
      {zonas && zonas.length > 0 && (
        <div className="dif-zonas-grid">
          {agruparPorBarrio(zonas).map((grupo) => (
            <div className="dif-zona-card" key={grupo.barrio}>
              <div className="dif-zona-nombre">{(grupo.barrio || '').replace(/-/g, ' ')}</div>
              <div className="dif-zona-tipos">
                {['departamentos', 'casas'].filter((t) => grupo.tipos[t]).map((t) => {
                  const z = grupo.tipos[t];
                  const velocidad = z.dias_promedio_publicado == null ? null
                    : z.dias_promedio_publicado <= 45 ? 'rápida' : z.dias_promedio_publicado <= 90 ? 'media' : 'lenta';
                  const velClase = velocidad === 'lenta' ? 'baja' : velocidad === 'media' ? 'media' : 'buena';
                  // Mismos umbrales que _nivel_competencia en asistente.py.
                  const compClase = z.cantidad_activas >= 1000 ? 'baja' : z.cantidad_activas >= 300 ? 'media' : 'buena';
                  return (
                    <div className="dif-zona-col" key={t}>
                      <div className="dif-zona-tipo-head">{TIPO_ICONO[t] || ''} {t === 'departamentos' ? 'Departamentos' : 'Casas'}</div>
                      <div className="dif-zona-stats">
                        <div className="dif-zona-stat">
                          <span className={'dif-chip dif-chip-' + compClase}>{z.cantidad_activas} activas</span>
                          <span className="dif-zona-lbl">competencia</span>
                        </div>
                        {velocidad && (
                          <div className="dif-zona-stat">
                            <span className={'dif-chip dif-chip-' + velClase}>{Math.round(z.dias_promedio_publicado)} días</span>
                            <span className="dif-zona-lbl">venta {velocidad}</span>
                          </div>
                        )}
                        {z.precio_m2_promedio != null && (
                          <div className="dif-zona-stat">
                            <span className="dif-chip">USD {Math.round(z.precio_m2_promedio).toLocaleString('es-AR')}/m²</span>
                            <span className="dif-zona-lbl">precio{z.n_comparables_precio ? ` · ${z.n_comparables_precio} publ.` : ''}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="dif-section-title" style={{ marginTop: 28 }}><h3>¿Cuánto invertir en difusión?</h3></div>
      <div className="dif-calc-card">
        <p className="tq-muted" style={{ marginTop: -6 }}>Elegí para cuál de tus zonas es el presupuesto y te sugerimos cómo repartirlo, según la competencia real de esa zona.</p>
        {zonas && zonas.length > 0 && (
          <div className="dif-calc-row" style={{ marginBottom: 10 }}>
            <select className="camp-nueva-input dif-zona-select" value={zonaSel} onChange={(e) => setZonaSel(e.target.value)} style={{ flex: '1 1 100%' }}>
              {agruparPorBarrio(zonas).map((grupo) => (
                ['departamentos', 'casas'].filter((t) => grupo.tipos[t]).map((t) => {
                  const z = grupo.tipos[t];
                  return (
                    <option key={grupo.barrio + '|' + t} value={grupo.barrio + '|' + t}>
                      {(grupo.barrio || '').replace(/-/g, ' ')} — {t === 'departamentos' ? 'Departamentos' : 'Casas'} ({z.cantidad_activas} activas)
                    </option>
                  );
                })
              ))}
            </select>
          </div>
        )}
        <div className="dif-calc-row">
          <select className="camp-nueva-input dif-moneda-select" value={moneda} onChange={(e) => setMoneda(e.target.value)}>
            <option value="ARS">$ (pesos)</option>
            <option value="USD">USD (dólares)</option>
          </select>
          <input
            className="camp-nueva-input" type="number" min="0" placeholder="Ej: 500000"
            value={presupuesto} onChange={(e) => setPresupuesto(e.target.value)}
          />
          <button className="camp-start" disabled={!presupuesto || calculando} onClick={calcular}>
            {calculando ? 'Calculando…' : 'Calcular'}
          </button>
        </div>
        {errorCalc && <p className="tq-error" style={{ marginTop: 10 }}>{errorCalc}</p>}

        {resultado && (
          <div className="dif-resultado">
            <div className="dif-resultado-zona">
              Para <b>{resultado.zona_referencia.barrio}</b> ({resultado.zona_referencia.tipo_inmueble}).
            </div>
            {resultado.evidencia_destacado && (
              <div className="mb-banner mb-media" style={{ marginBottom: 14 }}>
                <span className="mb-icon">📊</span>
                <span className="mb-texto">{resultado.evidencia_destacado}</span>
              </div>
            )}
            {resultado.reparto.map((r, i) => (
              <div className="dif-reparto-row" key={i}>
                <div className="dif-reparto-top">
                  <span className="dif-reparto-canal">{r.canal}</span>
                  <span className="dif-reparto-monto">{r.pct}% · {resultado.moneda === 'ARS' ? '$' : 'USD'} {r.monto.toLocaleString('es-AR')}</span>
                </div>
                <div className="tq-bar-track"><div className="tq-bar-fill" style={{ width: r.pct + '%' }}></div></div>
                <p className="dif-reparto-motivo">{r.motivo}</p>
                {r.pasos && r.pasos.length > 0 && (
                  <ol className="dif-pasos">
                    {r.pasos.map((p, j) => <li key={j}>{p}</li>)}
                  </ol>
                )}
                {r.canal === 'Destacar en el portal' && (
                  destaqueMarcado ? (
                    <p className="dif-aviso" style={{ marginTop: 8 }}>Anotado — en unos días te preguntamos acá mismo si te sirvió.</p>
                  ) : (
                    <button className="camp-start" style={{ marginTop: 8 }} disabled={marcandoDestaque} onClick={marcarDestaque}>
                      {marcandoDestaque ? 'Anotando…' : 'Ya lo hice — avisame en unos días si sirvió'}
                    </button>
                  )
                )}
              </div>
            ))}
            {resultado.nota_velocidad && <div className="mb-banner mb-media" style={{ marginTop: 14 }}><span className="mb-icon">⏱</span><span className="mb-texto">{resultado.nota_velocidad}</span></div>}
            <p className="dif-aviso">{resultado.aviso}</p>
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { Difusion });
