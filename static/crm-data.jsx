// buildCrmData — transforma contactos crudos de Supabase al formato de los componentes React.
// Cargado después de crm-components.jsx (necesita tiempoSinHablar, esUrgente).

(function() {

function diasDesde(fecha) {
  if (!fecha) return null;
  let s = String(fecha).trim();
  let d;
  if (/^\d{4}-\d{2}-\d{2}/.test(s))         d = new Date(s.slice(0, 10));
  else if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) { const [dd,mm,yyyy]=s.split('/'); d = new Date(+yyyy, mm-1, +dd); }
  else if (/^\d{2}-\d{2}-\d{4}/.test(s))   { const [dd,mm,yyyy]=s.split('-'); d = new Date(+yyyy, mm-1, +dd); }
  else return null;
  if (isNaN(d)) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  return Math.floor((today - d) / 86400000);
}

function parseCumple(s) {
  if (!s) return null;
  const str = String(s).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) { const [dd,mm,yyyy]=str.split('/'); return `${yyyy}-${mm}-${dd}`; }
  if (/^\d{2}-\d{2}-\d{4}$/.test(str))   { const [dd,mm,yyyy]=str.split('-'); return `${yyyy}-${mm}-${dd}`; }
  return null;
}

function mkIniciales(nombre) {
  if (!nombre) return '?';
  const p = nombre.trim().split(/\s+/);
  return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : nombre.slice(0, 2).toUpperCase();
}

function mapEtapa(e) {
  if (!e) return 'sin';
  const l = e.toLowerCase();
  if (l.includes('caliente'))             return 'caliente';
  if (l.includes('media') || l.includes('tibio')) return 'media';
  if (l.includes('fria') || l.includes('fría')) return 'fria';
  return 'sin';
}

function urgencia(c) {
  const w = { caliente: 100, media: 60, fria: 20, sin: 0 };
  return (w[c.etapa] || 0) + Math.min((c.diasSinContacto || 0) * 0.5, 80);
}

function genMensaje(c, agente) {
  const primer = (c.nombre || '').split(' ')[0];
  const nec = c.necesidad || 'el tema de la propiedad';
  if (c.etapa === 'caliente')
    return `Hola ${primer}! ¿Cómo estás? Quería ver cómo sigue lo de ${nec}. Estoy a disposición cuando necesites.`;
  if (c.etapa === 'media')
    return `Hola ${primer}! Hace un tiempo no hablamos. ¿Seguís con planes de ${nec}?`;
  return `Hola ${primer}! Soy ${agente} de MT90. ¿Seguís con interés en ${nec}?`;
}

window.buildCrmData = function(contacts, done) {
  const agente = window._AGENTE_NOMBRE || 'Agente';

  const all = contacts.map(c => {
    const etapa = mapEtapa(c.etapa);
    const diasSinContacto = diasDesde(c.fecha_ultimo_contacto);
    const cumple = parseCumple(c.fecha_nacimiento || c.cumpleanos || '');
    const nombre = c.nombre || c.cliente || '';
    const base = {
      id:               c.id,
      nombre,
      iniciales:        mkIniciales(nombre),
      telefono:         c.telefono || '',
      necesidad:        c.necesidad || '',
      antecedente:      c.antecedente || '',
      proximaAccion:    c.proxima_accion || '',
      diasSinContacto,
      dias:             diasSinContacto,
      cumple,
      etapa,
      contexto:         [],
      nota:             c.necesidad || c.antecedente || c.proxima_accion || '',
      señales:          [],
    };
    base.mensaje = genMensaje(base, agente);
    return base;
  });

  all.sort((a, b) => urgencia(b) - urgencia(a));

  // Cola del día: calientes primero, luego medias, max 60
  const hoy = all.filter(c => c.etapa === 'caliente' || c.etapa === 'media' || (c.diasSinContacto != null && c.diasSinContacto > 30)).slice(0, 60);
  if (hoy.length < 5) all.slice(0, 10).forEach(c => { if (!hoy.find(h => h.id === c.id)) hoy.push(c); });

  const byEtapa = k => all.filter(c => c.etapa === k);

  const calientes  = byEtapa('caliente');
  const enfriando  = calientes.filter(c => c.diasSinContacto != null && c.diasSinContacto > 60).slice(0, 3).map(c => c.id);
  const opors      = calientes.slice(0, 3).map(c => ({
    id:      c.id,
    icono:   'deal',
    titulo:  c.nombre + ' · caliente',
    detalle: (c.necesidad ? `Necesita: ${c.necesidad}. ` : '') + (c.diasSinContacto != null ? window.tiempoSinHablar(c.diasSinContacto) + '.' : ''),
  }));

  return {
    agente,
    totalContactos: all.length,
    hoy,
    cartera: {
      caliente: byEtapa('caliente'),
      media:    byEtapa('media'),
      fria:     byEtapa('fria'),
      sin:      byEtapa('sin'),
    },
    semana: {
      servicio:      'Tracción',
      revisados:     all.length,
      oportunidades: opors,
      enfriando,
      cierre: {
        hablados:  Object.values(done || {}).filter(Boolean).length,
        objetivo:  Math.min(hoy.length, 20),
        nuevos:    0,
        reuniones: 0,
        racha:     1,
      },
    },
    _all: all,
  };
};

})();
