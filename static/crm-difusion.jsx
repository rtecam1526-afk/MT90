// DIFUSIÓN — dashboard de competencia/velocidad por zona (datos reales del
// Radar, no estimaciones) + calculadora de reparto de presupuesto. Ayuda a
// decidir dónde conviene pautar y dónde no hace falta.
const { useState: useStateD, useEffect: useEffectD } = React;

function nivelColor(nivel) {
  if (nivel === 'alta' || nivel === 'lenta') return 'baja';
  if (nivel === 'media') return 'media';
  return 'buena';
}

function Difusion() {
  const [zonas, setZonas] = useStateD(null);
  const [error, setError] = useStateD(null);
  const [presupuesto, setPresupuesto] = useStateD('');
  const [moneda, setMoneda] = useStateD('ARS');
  const [calculando, setCalculando] = useStateD(false);
  const [resultado, setResultado] = useStateD(null);
  const [errorCalc, setErrorCalc] = useStateD(null);

  useEffectD(() => {
    if (!window.CRM_API) return;
    window.CRM_API.get('/difusion/zonas').then((r) => setZonas(r.zonas || [])).catch((e) => setError(e.message));
  }, []);

  async function calcular() {
    const monto = parseFloat(presupuesto);
    if (!monto || monto <= 0) return;
    setCalculando(true);
    setErrorCalc(null);
    setResultado(null);
    try {
      const r = await window.CRM_API.post('/difusion/calculadora', { presupuesto: monto, moneda });
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

      <div className="dif-section-title"><h3>Tus zonas, hoy</h3></div>
      {error && <p className="tq-error">No se pudo cargar: {error}</p>}
      {!error && zonas === null && <p className="tq-muted">Cargando…</p>}
      {zonas && zonas.length === 0 && (
        <p className="tq-muted">Todavía no hay datos — corré el Radar al menos una vez para ver la competencia de tus zonas acá.</p>
      )}
      {zonas && zonas.length > 0 && (
        <div className="dif-zonas-grid">
          {zonas.map((z) => {
            const velocidad = z.dias_promedio_publicado == null ? null
              : z.dias_promedio_publicado <= 45 ? 'rápida' : z.dias_promedio_publicado <= 90 ? 'media' : 'lenta';
            const velClase = velocidad === 'lenta' ? 'baja' : velocidad === 'media' ? 'media' : 'buena';
            // Mismos umbrales que _nivel_competencia en asistente.py — calibrados
            // contra el total REAL de Zonaprop por zona, no lo que se scrapeó.
            const compClase = z.cantidad_activas >= 1000 ? 'baja' : z.cantidad_activas >= 300 ? 'media' : 'buena';
            return (
              <div className="dif-zona-card" key={z.barrio + z.tipo_inmueble}>
                <div className="dif-zona-top">
                  <span className="dif-zona-nombre">{(z.barrio || '').replace(/-/g, ' ')}</span>
                  <span className="dif-zona-tipo">{z.tipo_inmueble}</span>
                </div>
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
                      <span className="dif-zona-lbl">precio zona{z.n_comparables_precio ? ` · ${z.n_comparables_precio} publ.` : ''}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="dif-section-title" style={{ marginTop: 28 }}><h3>¿Cuánto invertir en difusión?</h3></div>
      <div className="dif-calc-card">
        <p className="tq-muted" style={{ marginTop: -6 }}>Cargá tu presupuesto del mes y te sugerimos cómo repartirlo, según la competencia real de tu zona con más movimiento.</p>
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
              Basado en <b>{resultado.zona_referencia.barrio}</b> ({resultado.zona_referencia.tipo_inmueble}) — tu zona con más actividad.
            </div>
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
