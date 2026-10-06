// TEAM QUEST — capa de gamificación real, arriba del motor de MT90.
// Todo lo que se ve acá sale de /teamquest/resumen y /teamquest/oficina,
// que a su vez leen eventos_comerciales — nada de datos de mentira.
const { useState: useStateTQ, useEffect: useEffectTQ } = React;

// Confetti liviano, sin librerías — crea unos divs, los anima con CSS y se
// autodestruye. Se usa para celebrar momentos puntuales (todas las metas del
// día cumplidas), no para decorar todo — un efecto usado seguido deja de
// sentirse especial.
var TQ_CONFETTI_COLORES = ['#E0633A', '#17B892', '#D8922E', '#4C6FFE', '#EF5B96'];
function dispararConfetti() {
  var cont = document.createElement('div');
  cont.className = 'tq-confetti-layer';
  var n = 26;
  for (var i = 0; i < n; i++) {
    var pieza = document.createElement('span');
    pieza.className = 'tq-confetti-pieza';
    var left = Math.random() * 100;
    var delay = Math.random() * 0.25;
    var dur = 1.6 + Math.random() * 0.9;
    var color = TQ_CONFETTI_COLORES[i % TQ_CONFETTI_COLORES.length];
    pieza.style.left = left + '%';
    pieza.style.background = color;
    pieza.style.animationDelay = delay + 's';
    pieza.style.animationDuration = dur + 's';
    if (Math.random() > 0.5) pieza.style.borderRadius = '50%';
    cont.appendChild(pieza);
  }
  document.body.appendChild(cont);
  setTimeout(function () { cont.remove(); }, 2700);
}

// Hook chico: arranca en 0 y pasa al valor real recién después del primer
// paint, para que la barra se vea "llenar" en vez de aparecer ya completa.
function useAnimarAlMontar(valorReal, delayMs) {
  const [mostrado, setMostrado] = useStateTQ(0);
  useEffectTQ(() => {
    const t = setTimeout(() => setMostrado(valorReal), delayMs || 80);
    return () => clearTimeout(t);
  }, [valorReal]);
  return mostrado;
}

// Barra de una meta individual — componente propio porque el hook de arriba
// no se puede llamar adentro de un .map() (reglas de hooks de React).
function TQMetaBarFill({ pct }) {
  const mostrado = useAnimarAlMontar(pct, 150);
  return <div className="tq-bar-fill" style={{ width: mostrado + '%' }}></div>;
}

var TQ_TIERS = [
  { level: 1,  icon: 'plain',     name: 'Iniciado' },
  { level: 3,  icon: 'phone',     name: 'Conectado' },
  { level: 5,  icon: 'briefcase', name: 'Estratega' },
  { level: 7,  icon: 'home',      name: 'Constructor de Negocios' },
  { level: 10, icon: 'trophy',    name: 'Referente' },
  { level: 15, icon: 'rocket',    name: 'Elite Regional' },
];
var TQ_ICONS = {
  plain: '',
  phone: '<rect x="8" y="4" width="8" height="16" rx="2" fill="none" stroke-width="2"/><circle cx="12" cy="17" r=".9"/>',
  briefcase: '<rect x="4" y="8" width="16" height="11" rx="2" fill="none" stroke-width="2"/><path d="M9 8V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" fill="none" stroke-width="2"/>',
  home: '<path d="M4 11 12 4l8 7" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 10v9h12v-9" fill="none" stroke-width="2" stroke-linejoin="round"/>',
  trophy: '<path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" fill="none" stroke-width="2"/><path d="M7 6H4a3 3 0 0 0 3 5M17 6h3a3 3 0 0 1-3 5" fill="none" stroke-width="2"/><path d="M12 14v3M9 20h6" stroke-width="2" stroke-linecap="round"/>',
  rocket: '<path d="M12 3c3 2 4.5 5.5 4 10l-4 4-4-4c-.5-4.5 1-8 4-10Z" fill="none" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="10" r="1.6"/><path d="M9 17l-2 4M15 17l2 4" stroke-width="2" stroke-linecap="round"/>',
};
var TQ_HAIRES = ['#2b2320', '#4a3222', '#7a4a2a', '#caa46b', '#8a3324', '#5c4530'];
var TQ_TEAMCOLORS = ['#E0633A', '#4C6FFE', '#17B892', '#EF5B96', '#D8922E'];

function tqHash(str) {
  var h = 0;
  for (var i = 0; i < (str || '').length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}
function tqTierFor(level) {
  var t = TQ_TIERS[0];
  for (var i = 0; i < TQ_TIERS.length; i++) if (level >= TQ_TIERS[i].level) t = TQ_TIERS[i];
  return t;
}
function tqHairFor(key) { return TQ_HAIRES[tqHash(key) % TQ_HAIRES.length]; }
function tqTeamColorFor(key) { return TQ_TEAMCOLORS[tqHash(key) % TQ_TEAMCOLORS.length]; }

// Mismo criterio que el banner de "Hoy" (MetasRecordatorio más abajo), para
// que el ánimo del avatar y el mensaje del banner cuenten siempre la misma
// historia — una sola fuente de verdad, no dos lógicas que se puedan
// desalinear con el tiempo.
function tqNivelDia(metas) {
  var diarias = (metas || []).filter((m) => m.periodo === 'diario');
  if (diarias.length === 0) return { nivel: 'sin-metas', mood: 'neutral', faltantes: [] };
  var faltantes = diarias.filter((m) => !m.cumplida);
  var hora = new Date().getHours();
  if (faltantes.length === 0) return { nivel: 'ok', mood: 'feliz', faltantes: faltantes };
  if (hora >= 19) return { nivel: 'urgente', mood: 'preocupado', faltantes: faltantes };
  if (hora >= 13) return { nivel: 'media', mood: 'neutral', faltantes: faltantes };
  return { nivel: 'calma', mood: 'neutral', faltantes: faltantes };
}

// Tres variantes de boca — el resto de la cara (ojos, cejas) no cambia, para
// que siga siendo reconocible como "el mismo" avatar, solo con otro ánimo.
var TQ_BOCAS = {
  feliz:      'M35 61 Q50 80 65 61',
  neutral:    'M38 63 Q50 72 62 63',
  preocupado: 'M38 65 Q50 58 62 65',
};

function tqAvatarSVG(level, size, key, opts) {
  opts = opts || {};
  var t = tqTierFor(level);
  var hair = tqHairFor(key || 'x');
  var accent = opts.accent || 'var(--primary)';
  var skin = '#ffd9ad';
  var ink = '#2A2530';
  var hasBadge = t.icon !== 'plain';
  var boca = TQ_BOCAS[opts.mood] || TQ_BOCAS.neutral;
  var cls = 'tq-avatar' + (opts.interactive ? ' tq-avatar-live' : '');
  var html = '<svg class="' + cls + '" width="' + size + '" height="' + size + '" viewBox="0 0 100 100">';
  html += '<g class="tq-arm-left"><rect x="11" y="68" width="11" height="24" rx="5.5" fill="' + skin + '"/><circle cx="16.5" cy="92" r="5.5" fill="' + skin + '"/></g>';
  html += '<g class="tq-arm-right"><rect x="78" y="68" width="11" height="24" rx="5.5" fill="' + skin + '"/><circle cx="83.5" cy="92" r="5.5" fill="' + skin + '"/></g>';
  html += '<g class="tq-body">';
  html += '<path d="M20 92 C20 72 32 64 50 64 C68 64 80 72 80 92 Z" fill="' + accent + '"/>';
  html += '<path d="M46 66 L50 76 L54 66 Z" fill="#ffffff" opacity=".85"/>';
  html += '<rect x="43" y="38" width="14" height="27" rx="5" fill="' + skin + '"/>';
  html += '<circle cx="50" cy="30" r="22" fill="' + skin + '"/>';
  html += '<path d="M28 26 C28 10 72 10 72 26 C72 16 60 12 50 12 C40 12 28 16 28 26 Z" fill="' + hair + '"/>';
  html += '<path d="M28 24 C26 30 27 36 30 40 C27 34 27 27 29 22 Z" fill="' + hair + '"/>';
  html += '<path d="M72 24 C74 30 73 36 70 40 C73 34 73 27 71 22 Z" fill="' + hair + '"/>';
  html += '<path d="M37 25.5 q4 -2.4 7 -.3" fill="none" stroke="' + ink + '" stroke-width="1.7" stroke-linecap="round"/>';
  html += '<path d="M56 25.2 q4 -2.1 7 .4" fill="none" stroke="' + ink + '" stroke-width="1.7" stroke-linecap="round"/>';
  html += '<g class="tq-eyes"><circle cx="42" cy="31" r="3" fill="' + ink + '"/><circle cx="58" cy="31" r="3" fill="' + ink + '"/></g>';
  html += '<path class="tq-mouth" d="' + boca + '" transform="translate(0,-27)" fill="none" stroke="' + ink + '" stroke-width="2.6" stroke-linecap="round"/>';
  html += '</g>';
  if (hasBadge) {
    var sc = 0.42, bx = 78, by = 80;
    html += '<g class="tq-badge"><circle cx="' + bx + '" cy="' + by + '" r="17" fill="var(--primary)" stroke="#fff" stroke-width="3"/>' +
      '<g transform="translate(' + (bx - 24 * sc / 2) + ',' + (by - 24 * sc / 2) + ') scale(' + sc + ')" fill="#fff" stroke="#fff">' + TQ_ICONS[t.icon] + '</g></g>';
  }
  html += '</svg>';
  return html;
}

var TQ_XP_LABELS = {
  contacto_activado: 'Contactos activados', llamada: 'Llamadas', conversacion: 'Conversaciones', visita: 'Visitas a propiedades',
  reactivacion: 'Reactivaciones', tasacion: 'Tasaciones (ACM)', reunion: 'Reuniones', referido: 'Referidos',
  captacion: 'Captaciones/operaciones', nuevo_comprador: 'Nuevos compradores', operacion: 'Operaciones grandes',
};
var TQ_XP_TABLE = [
  ['Contacto activado', 10], ['Llamada', 10], ['Conversación', 20], ['Actualizar el CRM (1 vez al día)', 5],
  ['Reactivación de contacto', 30], ['Visita a propiedad', 40], ['Tasación (ACM)', 20],
  ['Reunión', 100], ['Nuevo comprador', 200], ['Referido', 150],
  ['Captación / operación', 300], ['Operación grande', 500],
];

function tqBadgesFor(conteos, racha, nivel) {
  var c = conteos || {};
  return [
    { icon: 'home',      t: 'Primera captación',   d: 'Cerraste tu primera captación',        ok: (c.captacion || 0) >= 1 },
    { icon: 'phone',     t: '7 días activos',       d: 'Una semana entera con actividad',      ok: racha >= 7 },
    { icon: 'phone',     t: 'Reactivador',          d: 'Reactivaste un contacto frío',         ok: (c.reactivacion || 0) >= 1 },
    { icon: 'trophy',    t: 'Maestro de reuniones', d: '10 reuniones registradas',             ok: (c.reunion || 0) >= 10 },
    { icon: 'briefcase', t: 'Rompehielos',          d: '20 conversaciones registradas',        ok: (c.conversacion || 0) >= 20 },
    { icon: 'briefcase', t: 'Arranque fuerte',      d: '20 contactos nuevos activados',        ok: (c.contacto_activado || 0) >= 20 },
    { icon: 'rocket',    t: 'Subiste de nivel',     d: 'Dejaste atrás el Nivel 1',             ok: nivel >= 2 },
    { icon: 'plain',     t: 'Volvé a buscarlo',     d: 'Logro oculto: reactivaste 3 contactos fríos', ok: (c.reactivacion || 0) >= 3, hidden: true },
  ];
}

function TeamQuest({ agenteNombre }) {
  const [mio, setMio] = useStateTQ(null);
  const [oficina, setOficina] = useStateTQ(null);
  const [error, setError] = useStateTQ(null);
  const [sub, setSub] = useStateTQ('perfil');
  // OJO: este hook tiene que estar ACÁ, antes de los "return" condicionales
  // de más abajo (mientras carga / si hay error) — React exige que todos los
  // hooks de un componente se llamen siempre en el mismo orden en cada
  // render. Ponerlo después de un return condicional ya rompió Campañas una
  // vez ("Rendered fewer hooks than expected"), no repetir el error acá.
  const pctHeroAnimado = useAnimarAlMontar(mio ? mio.pct_nivel_actual : 0, 150);

  useEffectTQ(() => {
    if (!window.CRM_API) return;
    Promise.all([
      window.CRM_API.get('/teamquest/resumen'),
      window.CRM_API.get('/teamquest/oficina'),
    ]).then(([r1, r2]) => { setMio(r1); setOficina(r2); })
      .catch((e) => setError(e.message));
  }, []);

  function poke(e) {
    var av = e.target.closest('.tq-avatar-live');
    if (!av) return;
    av.classList.remove('tq-poke'); void av.offsetWidth; av.classList.add('tq-poke');
    setTimeout(function () { av.classList.remove('tq-poke'); }, 600);
  }

  if (error) return <div className="tq-wrap"><p className="tq-error">No se pudo cargar Team Quest: {error}</p></div>;
  if (!mio || !oficina) return <div className="tq-wrap"><p className="tq-muted">Cargando tu evolución…</p></div>;

  const tier = tqTierFor(mio.nivel);
  const badges = tqBadgesFor(mio.conteos_totales, mio.racha_dias, mio.nivel);

  const ranking = [];
  oficina.equipos.forEach((eq) => {
    eq.agentes.forEach((a) => ranking.push({ ...a, equipo: eq.lider_nombre, equipoKey: eq.lider_key }));
  });
  ranking.sort((a, b) => b.xp_total - a.xp_total);

  const miEquipo = oficina.equipos.filter((eq) => eq.agentes.some((a) => a.key === mio.agente))[0];
  const reunionesEquipoTotal = miEquipo ? miEquipo.agentes.reduce((s, a) => s + ((a.conteos || {}).reunion || 0), 0) : 0;
  const referidosOficinaTotal = ranking.reduce((s, a) => s + ((a.conteos || {}).referido || 0), 0);

  return (
    <div className="tq-wrap fade-in" onClick={poke}>
      <div className="tq-head">
        <h1>Team Quest</h1>
        <p className="tq-muted">Tu evolución comercial, medida con lo que ya hacés todos los días en MT90.</p>
      </div>

      <nav className="tq-subnav">
        <button className={sub === 'perfil' ? 'active' : ''} onClick={() => setSub('perfil')}>👤 Mi perfil</button>
        <button className={sub === 'ranking' ? 'active' : ''} onClick={() => setSub('ranking')}>🏅 Ranking</button>
        {miEquipo && miEquipo.agentes.length > 1 && (
          <button className={sub === 'equipo' ? 'active' : ''} onClick={() => setSub('equipo')}>👥 Mi equipo</button>
        )}
        {mio.es_broker && (
          <button className={sub === 'oficina' ? 'active' : ''} onClick={() => setSub('oficina')}>🏢 Oficina</button>
        )}
        <button className={sub === 'misiones' ? 'active' : ''} onClick={() => setSub('misiones')}>🎯 Misiones</button>
        <button className={sub === 'evolucion' ? 'active' : ''} onClick={() => setSub('evolucion')}>✨ Evolución</button>
      </nav>

      {sub === 'perfil' && (
        <React.Fragment>
          <div className="tq-card tq-hero">
            <div className="tq-avatar-slot" dangerouslySetInnerHTML={{ __html: tqAvatarSVG(mio.nivel, 92, mio.agente, { interactive: true, mood: tqNivelDia(mio.metas).mood }) }} />
            <div className="tq-hero-info">
              <div className="tq-eyebrow">Nivel {mio.nivel} · {tier.name}</div>
              <h2>{agenteNombre || mio.agente}</h2>
              <div className="tq-bar-row">
                <div className="tq-bar-track tq-bar-track-hero"><div className="tq-bar-fill tq-bar-fill-hero" style={{ width: pctHeroAnimado + '%' }}></div></div>
                <span className="tq-pct">{mio.pct_nivel_actual}%</span>
              </div>
              <p className="tq-muted" style={{ marginTop: 4 }}>{mio.xp_total.toLocaleString('es-AR')} XP totales · faltan {(500 - (mio.xp_total % 500))} XP para Nivel {mio.nivel + 1}</p>
            </div>
          </div>

          <div className="tq-flair-row">
            <span className="tq-flair-pill tq-streak">🔥 {mio.racha_dias} {mio.racha_dias === 1 ? 'día' : 'días'} de racha</span>
            <span className="tq-flair-pill tq-mood">{mio.total_eventos > 0 ? '😄 En movimiento' : '🌱 Recién arrancando'}</span>
          </div>

          <div className="tq-section-title"><h3>Metas de hoy</h3></div>
          <div className="tq-metas-list">
            {(mio.metas || []).map((m) => (
              <div className={'tq-meta-row' + (m.cumplida ? ' tq-meta-ok' : '')} key={m.tipo}>
                <span className="tq-meta-icon">{m.icono}</span>
                <div className="tq-meta-mid">
                  <div className="tq-meta-top">
                    <span className="tq-meta-label">{m.label}</span>
                    <span className="tq-meta-sub">{m.periodo === 'semanal' ? 'Esta semana' : 'Una vez al día'}</span>
                  </div>
                  <div className="tq-bar-track">
                    <TQMetaBarFill pct={Math.min(100, (m.progreso / m.objetivo) * 100)} />
                  </div>
                </div>
                <span className="tq-meta-frac">{m.progreso}/{m.objetivo}</span>
                {m.cumplida && <span className="tq-meta-check">✓</span>}
              </div>
            ))}
          </div>

          <div className="tq-section-title"><h3>Esta semana</h3></div>
          <div className="tq-stat-grid">
            {Object.keys(TQ_XP_LABELS).map((k) => (
              <div className="tq-stat-tile" key={k}>
                <span className="tq-stat-v">{mio.eventos_semana[k] || 0}</span>
                <span className="tq-stat-l">{TQ_XP_LABELS[k]}</span>
              </div>
            ))}
          </div>
        </React.Fragment>
      )}

      {sub === 'ranking' && (
        <React.Fragment>
          <div className="tq-section-title"><h3>Ranking de la oficina</h3><span className="tq-muted">{ranking.length} agentes</span></div>
          <div className="tq-rank-list">
            {ranking.length === 0 && <p className="tq-muted">Todavía no hay actividad registrada — arranca hoy mismo.</p>}
            {ranking.map((a, i) => {
              const pos = i + 1;
              const medal = pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : null;
              const esYo = a.key === mio.agente;
              const rowCls = 'tq-rank-row' + (esYo ? ' tq-me' : '') + (pos <= 3 ? ' tq-top' + pos : '');
              return (
                <div className={rowCls} key={a.key}>
                  {medal ? <span className="tq-medal">{medal}</span> : <span className="tq-rank-num">{pos}</span>}
                  <div className="tq-avatar-slot tq-avatar-slot-sm" dangerouslySetInnerHTML={{ __html: tqAvatarSVG(a.nivel, 36, a.key, { accent: tqTeamColorFor(a.equipoKey) }) }} />
                  <div className="tq-rank-id">
                    <div className="tq-rank-name">{a.nombre}{esYo ? ' · vos' : ''}</div>
                    <span className="tq-team-tag" style={{ background: tqTeamColorFor(a.equipoKey) + '20', color: tqTeamColorFor(a.equipoKey) }}>{a.equipo}</span>
                  </div>
                  <span className="tq-rank-xp">{a.xp_total.toLocaleString('es-AR')} XP</span>
                </div>
              );
            })}
          </div>
        </React.Fragment>
      )}

      {sub === 'equipo' && miEquipo && (
        <React.Fragment>
          <div className="tq-section-title"><h3>Mi equipo — hoy</h3><span className="tq-muted">{miEquipo.lider_nombre}</span></div>
          <p className="tq-muted" style={{ marginTop: -10 }}>Quién ya cumplió sus metas de hoy (llamadas, visitas, actualizar CRM) y quién todavía no — sin tener que preguntarle.</p>
          <div className="tq-team-list">
            {miEquipo.agentes.map((a) => {
              const metasDiarias = (a.metas || []).filter((m) => m.periodo === 'diario');
              const todoOk = a.metas_hoy_cumplidas === a.metas_hoy_total;
              return (
                <div className="tq-team-row" key={a.key}>
                  <div className="tq-avatar-slot tq-avatar-slot-sm" dangerouslySetInnerHTML={{ __html: tqAvatarSVG(a.nivel, 36, a.key, { accent: tqTeamColorFor(miEquipo.lider_key) }) }} />
                  <div className="tq-team-id">
                    <div className="tq-rank-name">{a.nombre}{a.key === mio.agente ? ' · vos' : ''}</div>
                    <div className="tq-team-metas">
                      {metasDiarias.map((m) => (
                        <span key={m.tipo} className={'tq-meta-chip' + (m.cumplida ? ' tq-meta-chip-ok' : '')} title={m.label + ': ' + m.progreso + '/' + m.objetivo}>{m.icono}</span>
                      ))}
                    </div>
                  </div>
                  <span className={'tq-team-frac' + (todoOk ? ' tq-team-frac-ok' : '')}>{a.metas_hoy_cumplidas}/{a.metas_hoy_total} hoy</span>
                </div>
              );
            })}
          </div>
        </React.Fragment>
      )}

      {sub === 'oficina' && mio.es_broker && (
        <React.Fragment>
          <div className="tq-section-title"><h3>Salud de la oficina — hoy</h3><span className="tq-muted">{oficina.equipos.length} equipos</span></div>
          <p className="tq-muted" style={{ marginTop: -10 }}>% de metas diarias cumplidas por equipo — ordenado de quien más necesita empuje a quien va mejor.</p>
          <div className="tq-office-list">
            {[...oficina.equipos].sort((a, b) => a.pct_cumplimiento_hoy - b.pct_cumplimiento_hoy).map((eq) => {
              const nivelSalud = eq.pct_cumplimiento_hoy >= 80 ? 'ok' : eq.pct_cumplimiento_hoy >= 40 ? 'media' : 'baja';
              return (
                <div className="tq-office-card" key={eq.lider_key}>
                  <div className="tq-office-top">
                    <div className="tq-office-nombre">{eq.lider_nombre}</div>
                    <span className={'tq-office-pct tq-office-pct-' + nivelSalud}>{eq.pct_cumplimiento_hoy}% hoy</span>
                  </div>
                  <div className="tq-office-agentes">
                    {eq.agentes.map((a) => (
                      <span key={a.key} className={'tq-office-agente' + (a.metas_hoy_cumplidas === a.metas_hoy_total ? ' tq-office-agente-ok' : '')}>
                        {a.nombre}: {a.metas_hoy_cumplidas}/{a.metas_hoy_total}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </React.Fragment>
      )}

      {sub === 'misiones' && (
        <React.Fragment>
          <div className="tq-section-title"><h3>Misiones</h3></div>
          <p className="tq-muted" style={{ marginTop: -10 }}>Objetivos de referencia sobre tu actividad real — todavía no configurables por el broker, es el primer borrador.</p>
          <div className="tq-mission-grid">
            <div className="tq-mission-card">
              <span className="tq-mission-who">Misión personal</span>
              <h4>🎯 3 reuniones esta semana</h4>
              <div className="tq-bar-row">
                <div className="tq-bar-track tq-bar-track-hero"><div className="tq-bar-fill tq-bar-fill-hero" style={{ width: Math.min(100, ((mio.eventos_semana.reunion || 0) / 3) * 100) + '%' }}></div></div>
                <span className="tq-frac">{mio.eventos_semana.reunion || 0}/3</span>
              </div>
            </div>
            <div className="tq-mission-card">
              <span className="tq-mission-who">Misión de equipo{miEquipo ? ' · ' + miEquipo.lider_nombre : ''}</span>
              <h4>👥 20 reuniones acumuladas</h4>
              <div className="tq-bar-row">
                <div className="tq-bar-track tq-bar-track-hero"><div className="tq-bar-fill" style={{ width: Math.min(100, (reunionesEquipoTotal / 20) * 100) + '%' }}></div></div>
                <span className="tq-frac">{reunionesEquipoTotal}/20</span>
              </div>
            </div>
            <div className="tq-mission-card">
              <span className="tq-mission-who">Misión de oficina</span>
              <h4>🏢 20 referidos entre todos</h4>
              <div className="tq-bar-row">
                <div className="tq-bar-track tq-bar-track-hero"><div className="tq-bar-fill" style={{ width: Math.min(100, (referidosOficinaTotal / 20) * 100) + '%' }}></div></div>
                <span className="tq-frac">{referidosOficinaTotal}/20</span>
              </div>
            </div>
          </div>
        </React.Fragment>
      )}

      {sub === 'evolucion' && (
        <React.Fragment>
          <div className="tq-section-title"><h3>Línea de evolución</h3></div>
          <div className="tq-tier-track">
            {TQ_TIERS.map((tr) => {
              const reached = mio.nivel >= tr.level;
              return (
                <div className={'tq-tier-stop' + (reached ? ' reached' : '')} key={tr.level}>
                  <div className="tq-tier-connector"></div>
                  <div className="tq-tier-badge" dangerouslySetInnerHTML={{ __html: '<svg width="22" height="22" viewBox="0 0 24 24" fill="' + (reached ? 'var(--primary)' : '#B6AE9F') + '" stroke="' + (reached ? 'var(--primary)' : '#B6AE9F') + '">' + TQ_ICONS[tr.icon] + '</svg>' }}></div>
                  <span className="tq-tier-lvl">Nv. {tr.level}</span>
                  <span className="tq-tier-name">{tr.name}</span>
                </div>
              );
            })}
          </div>

          <div className="tq-section-title"><h3>Logros</h3><span className="tq-muted">{badges.filter((b) => b.ok).length} de {badges.length}</span></div>
          <div className="tq-badge-grid">
            {badges.map((b, i) => (
              <div className={'tq-badge' + (b.ok ? ' unlocked' : ' locked') + (b.hidden && !b.ok ? ' hidden-badge' : '')} key={i}>
                <div className="tq-badge-icon" dangerouslySetInnerHTML={{ __html: '<svg width="18" height="18" viewBox="0 0 24 24" fill="' + (b.ok ? '#fff' : '#B6AE9F') + '" stroke="' + (b.ok ? '#fff' : '#B6AE9F') + '">' + TQ_ICONS[b.icon] + '</svg>' }}></div>
                <span className="tq-badge-t">{b.hidden && !b.ok ? '🔒 Logro oculto' : b.t}</span>
                <span className="tq-badge-d">{b.d}</span>
              </div>
            ))}
          </div>

          <div className="tq-section-title"><h3>Cómo se gana XP</h3></div>
          <div className="tq-table-wrap">
            <table className="tq-xp-table">
              <thead><tr><th>Acción</th><th style={{ textAlign: 'right' }}>XP</th></tr></thead>
              <tbody>
                {TQ_XP_TABLE.map((row, i) => <tr key={i}><td>{row[0]}</td><td className="xp">+{row[1]} XP</td></tr>)}
              </tbody>
            </table>
          </div>
        </React.Fragment>
      )}
    </div>
  );
}

// RECORDATORIO DE METAS — banner en la pantalla "Hoy" que se pone más urgente
// a medida que avanza el día si quedan metas diarias sin cumplir. No hay
// notificaciones push reales (la app vive en el navegador, no es instalable
// como app nativa) — esto es la aproximación dentro del CRM: lo ve apenas
// entra, sin depender de que el celular le muestre algo.
function MetasRecordatorio() {
  const [mio, setMio] = useStateTQ(null);

  useEffectTQ(() => {
    if (!window.CRM_API) return;
    window.CRM_API.get('/teamquest/resumen').then(setMio).catch(() => {});
  }, []);

  const { nivel, faltantes } = tqNivelDia(mio && mio.metas);
  const diarias = (mio && mio.metas || []).filter((m) => m.periodo === 'diario');
  const todoListo = mio && diarias.length > 0 && nivel === 'ok';

  useEffectTQ(() => {
    if (!todoListo) return;
    const hoy = new Date().toISOString().slice(0, 10);
    const clave = 'mt90_confetti_' + mio.agente + '_' + hoy;
    try {
      if (localStorage.getItem(clave)) return;
      localStorage.setItem(clave, '1');
    } catch (e) { /* si localStorage falla, igual festejamos esta vez */ }
    dispararConfetti();
  }, [todoListo]);

  if (!mio) return null;
  if (diarias.length === 0) return null;

  let icono, texto;
  if (nivel === 'ok') {
    icono = '✅';
    texto = 'Completaste todas tus metas de hoy — gran trabajo.';
  } else if (nivel === 'urgente') {
    icono = '⏰';
    texto = 'El día se termina y todavía te falta: ' + faltantes.map((m) => m.label.toLowerCase()).join(', ') + '.';
  } else if (nivel === 'media') {
    icono = '🔔';
    texto = 'Vas a mitad de día — te faltan ' + faltantes.length + ' meta' + (faltantes.length === 1 ? '' : 's') + ' de hoy: ' + faltantes.map((m) => m.label.toLowerCase()).join(', ') + '.';
  } else {
    icono = '🌱';
    texto = 'Buen momento para arrancar con tus metas de hoy: ' + faltantes.map((m) => m.label.toLowerCase()).join(', ') + '.';
  }

  return (
    <div className={'mb-banner mb-' + nivel}>
      <span className="mb-icon">{icono}</span>
      <span className="mb-texto">{texto}</span>
    </div>
  );
}

Object.assign(window, { TeamQuest, MetasRecordatorio });
