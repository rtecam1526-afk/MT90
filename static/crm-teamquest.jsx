// TEAM QUEST — capa de gamificación real, arriba del motor de MT90.
// Fase 1: XP real desde eventos_comerciales (/teamquest/resumen y
// /teamquest/oficina). Todavía no tiene jerarquía visual de Team Leader
// separada del Broker — eso es la fase 2, cuando haya más de un team armado.
const { useState: useStateTQ, useEffect: useEffectTQ } = React;

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

function tqTierFor(level) {
  var t = TQ_TIERS[0];
  for (var i = 0; i < TQ_TIERS.length; i++) if (level >= TQ_TIERS[i].level) t = TQ_TIERS[i];
  return t;
}
function tqHairFor(key) {
  var h = 0;
  for (var i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return TQ_HAIRES[h % TQ_HAIRES.length];
}
function tqAvatarSVG(level, size, key, accent) {
  var t = tqTierFor(level);
  var hair = tqHairFor(key || 'x');
  var skin = '#ffd9ad';
  var ink = '#2A2530';
  var hasBadge = t.icon !== 'plain';
  var html = '<svg width="' + size + '" height="' + size + '" viewBox="0 0 100 100">';
  html += '<path d="M20 92 C20 72 32 64 50 64 C68 64 80 72 80 92 Z" fill="' + accent + '"/>';
  html += '<path d="M46 66 L50 76 L54 66 Z" fill="#ffffff" opacity=".85"/>';
  html += '<rect x="43" y="38" width="14" height="27" rx="5" fill="' + skin + '"/>';
  html += '<circle cx="50" cy="30" r="22" fill="' + skin + '"/>';
  html += '<path d="M28 26 C28 10 72 10 72 26 C72 16 60 12 50 12 C40 12 28 16 28 26 Z" fill="' + hair + '"/>';
  html += '<circle cx="42" cy="31" r="3" fill="' + ink + '"/><circle cx="58" cy="31" r="3" fill="' + ink + '"/>';
  html += '<path d="M39 61 Q50 70 61 61" fill="none" stroke="' + ink + '" stroke-width="2.6" stroke-linecap="round"/>';
  if (hasBadge) {
    var sc = 0.42, bx = 78, by = 80;
    html += '<circle cx="' + bx + '" cy="' + by + '" r="17" fill="var(--primary)" stroke="#fff" stroke-width="3"/>';
    html += '<g transform="translate(' + (bx - 24 * sc / 2) + ',' + (by - 24 * sc / 2) + ') scale(' + sc + ')" fill="#fff" stroke="#fff">' + TQ_ICONS[t.icon] + '</g>';
  }
  html += '</svg>';
  return html;
}

var TQ_XP_LABELS = {
  contacto_activado: 'Contactos activados', conversacion: 'Conversaciones', reactivacion: 'Reactivaciones',
  reunion: 'Reuniones', referido: 'Referidos', captacion: 'Captaciones/operaciones',
  nuevo_comprador: 'Nuevos compradores', operacion: 'Operaciones',
};

function TeamQuest({ agenteNombre }) {
  const [mio, setMio] = useStateTQ(null);
  const [oficina, setOficina] = useStateTQ(null);
  const [error, setError] = useStateTQ(null);

  useEffectTQ(() => {
    if (!window.CRM_API) return;
    Promise.all([
      window.CRM_API.get('/teamquest/resumen'),
      window.CRM_API.get('/teamquest/oficina'),
    ]).then(([r1, r2]) => { setMio(r1); setOficina(r2); })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="tq-wrap"><p className="tq-error">No se pudo cargar Team Quest: {error}</p></div>;
  if (!mio || !oficina) return <div className="tq-wrap"><p className="tq-muted">Cargando tu evolución…</p></div>;

  const tier = tqTierFor(mio.nivel);

  // Ranking de toda la oficina, aplanando los equipos.
  const ranking = [];
  oficina.equipos.forEach((eq) => {
    eq.agentes.forEach((a) => ranking.push({ ...a, equipo: eq.lider_nombre }));
  });
  ranking.sort((a, b) => b.xp_total - a.xp_total);

  return (
    <div className="tq-wrap fade-in">
      <div className="tq-head">
        <h1>Team Quest</h1>
        <p className="tq-muted">Tu evolución comercial, medida con lo que ya hacés todos los días en MT90.</p>
      </div>

      <div className="tq-card tq-hero">
        <div className="tq-avatar-slot" dangerouslySetInnerHTML={{ __html: tqAvatarSVG(mio.nivel, 88, mio.agente, 'var(--primary)') }} />
        <div className="tq-hero-info">
          <div className="tq-eyebrow">Nivel {mio.nivel} · {tier.name}</div>
          <h2>{agenteNombre || mio.agente}</h2>
          <div className="tq-bar-row">
            <div className="tq-bar-track"><div className="tq-bar-fill" style={{ width: mio.pct_nivel_actual + '%' }}></div></div>
            <span className="tq-pct">{mio.pct_nivel_actual}%</span>
          </div>
          <p className="tq-muted" style={{ marginTop: 4 }}>{mio.xp_total.toLocaleString('es-AR')} XP totales · faltan {(500 - (mio.xp_total % 500))} XP para Nivel {mio.nivel + 1}</p>
        </div>
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

      <div className="tq-section-title"><h3>Ranking de la oficina</h3><span className="tq-muted">{ranking.length} agentes</span></div>
      <div className="tq-rank-list">
        {ranking.length === 0 && <p className="tq-muted">Todavía no hay actividad registrada — arranca hoy mismo.</p>}
        {ranking.map((a, i) => {
          const pos = i + 1;
          const medal = pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : null;
          const esYo = a.key === mio.agente;
          return (
            <div className={'tq-rank-row' + (esYo ? ' tq-me' : '')} key={a.key}>
              {medal ? <span className="tq-medal">{medal}</span> : <span className="tq-rank-num">{pos}</span>}
              <div className="tq-avatar-slot tq-avatar-slot-sm" dangerouslySetInnerHTML={{ __html: tqAvatarSVG(a.nivel, 34, a.key, 'var(--primary)') }} />
              <div className="tq-rank-id">
                <div className="tq-rank-name">{a.nombre}{esYo ? ' · vos' : ''}</div>
                <div className="tq-rank-team">{a.equipo}</div>
              </div>
              <span className="tq-rank-xp">{a.xp_total.toLocaleString('es-AR')} XP</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

Object.assign(window, { TeamQuest });
