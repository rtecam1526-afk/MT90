// buildCrmData — transforma contactos crudos de Supabase al formato de los componentes.
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
  if (l.includes('caliente'))                       return 'caliente';
  if (l.includes('media') || l.includes('tibio'))   return 'media';
  if (l.includes('fria') || l.includes('fría'))     return 'fria';
  return 'sin';
}

function urgencia(c) {
  const w = { caliente: 100, media: 60, fria: 20, sin: 0 };
  let accionBonus = 0;
  if (c.proximaAccion) {
    accionBonus = 50;
    if (c.proximaFechaAccion) {
      const dias = diasDesde(c.proximaFechaAccion);
      if (dias !== null) {
        if (dias >= 0)       accionBonus = 120;  // vencida o es hoy
        else if (dias >= -3) accionBonus = 90;   // próximos 3 días
        else if (dias >= -7) accionBonus = 70;   // esta semana
      }
    }
  }
  return (w[c.etapa] || 0) + Math.min((c.diasSinContacto || 0) * 0.5, 80) + accionBonus;
}

function genMensaje(c, agente) {
  const primer = (c.nombre || '').split(' ')[0];
  const nec = c.necesidad || 'el tema de la propiedad';
  if (c.etapa === 'caliente')
    return `Hola ${primer}! ¿Cómo estás? Quería ver cómo sigue lo de ${nec}. Estoy a disposición cuando necesites.`;
  if (c.etapa === 'media')
    return `Hola ${primer}! Hace un tiempo no hablamos. ¿Seguís con planes de ${nec}?`;
  return `Hola ${primer}! Soy ${agente}. ¿Seguís con interés en ${nec}?`;
}

// Genera campañas de fechas especiales argentinas
function buildCampanas(contacts, agente) {
  const now = new Date();
  const year = now.getFullYear();

  // Fechas especiales ARG (aproximadas; se ajustan al año actual)
  function nthWeekday(y, month, weekday, n) {
    // weekday: 0=Sun,1=Mon...6=Sat  n: 1=first, 2=second, etc.
    let d = new Date(y, month, 1);
    let count = 0;
    while (true) {
      if (d.getDay() === weekday) { count++; if (count === n) return d; }
      d.setDate(d.getDate() + 1);
    }
  }

  function toISO(d) {
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }

  const fechas = [
    { id: 'padre',         titulo: 'Día del Padre',       fecha: toISO(nthWeekday(year, 5, 0, 3)) },
    { id: 'independencia', titulo: '9 de Julio',          fecha: `${year}-07-09` },
    { id: 'amigo',         titulo: 'Día del Amigo',       fecha: `${year}-07-20` },
    { id: 'maestra',       titulo: 'Día del Maestro',     fecha: `${year}-09-11` },
    { id: 'primavera',     titulo: 'Día de la Primavera', fecha: `${year}-09-21` },
    { id: 'madre',         titulo: 'Día de la Madre',     fecha: toISO(nthWeekday(year, 9, 0, 3)) },
    { id: 'navidad',       titulo: 'Navidad',             fecha: `${year}-12-25` },
    { id: 'anonuevo',      titulo: 'Año Nuevo',           fecha: `${year+1}-01-01` },
  ]
    .map(f => {
      const diff = Math.round((new Date(f.fecha) - now) / 86400000);
      return { ...f, enDias: diff, mensaje: `¡Feliz ${f.titulo}, ${'{nombre}'}! Un saludo grande de mi parte. — ${agente}` };
    })
    .filter(f => f.enDias >= 0)
    .sort((a, b) => a.enDias - b.enDias);

  const proxima = fechas[0] || {
    id: 'generic', titulo: 'Año Nuevo', fecha: `${year+1}-01-01`, enDias: 30,
    mensaje: `¡Feliz {titulo}! Un saludo de ${agente}.`,
  };

  proxima.alcance = contacts.length;

  return {
    proxima,
    agenda: fechas.slice(1),
  };
}

window.buildCrmData = function(contacts, done) {
  const agente = window._AGENTE_NOMBRE || 'Agente';

  const all = contacts.map(c => {
    const etapa = mapEtapa(c.etapa);
    const diasSinContacto = diasDesde(c.fecha_ultimo_contacto);
    // columna en Supabase es fecha_cumpleanos
    const cumple = parseCumple(c.fecha_cumpleanos || c.fecha_nacimiento || c.birthday || '');
    const nombre = c.nombre || c.cliente || '';
    const base = {
      id:               c.id,
      nombre,
      iniciales:        mkIniciales(nombre),
      telefono:         c.telefono || '',
      necesidad:        c.necesidad || '',
      antecedente:      c.antecedente || '',
      proximaAccion:        c.proxima_accion || '',
      proximaFechaAccion:   c.fecha_proxima_accion || '',
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

  // Cola del día: calientes + medias + contactos con mucho tiempo sin hablar
  const hoy = all.filter(c =>
    c.etapa === 'caliente' ||
    c.etapa === 'media' ||
    (c.diasSinContacto != null && c.diasSinContacto > 30)
  ).slice(0, 60);

  // Fallback: si hay muy pocos, completar con los primeros
  if (hoy.length < 5) {
    all.slice(0, 15).forEach(c => { if (!hoy.find(h => h.id === c.id)) hoy.push(c); });
  }

  const byEtapa = k => all.filter(c => c.etapa === k);

  const calientes  = byEtapa('caliente');
  const enfriando  = calientes
    .filter(c => c.diasSinContacto != null && c.diasSinContacto > 60)
    .slice(0, 3).map(c => c.id);

  const opors = calientes.slice(0, 3).map(c => ({
    id:      c.id,
    icono:   'deal',
    titulo:  c.nombre + ' · caliente',
    detalle: (c.necesidad ? `Necesita: ${c.necesidad}. ` : '') +
             (c.diasSinContacto != null ? window.tiempoSinHablar(c.diasSinContacto) + '.' : ''),
  }));

  // carteraQueue: todos los contactos con teléfono, para cola de campañas
  const carteraQueue = all.filter(c => c.telefono && c.telefono.trim()).slice(0, 30);

  // Contactos con próxima acción definida, ordenados por urgencia
  const conAccion = all
    .filter(c => c.proximaAccion && c.proximaAccion.trim())
    .slice(0, 15);

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
    campanas:     buildCampanas(all, agente),
    carteraQueue,
    semana: {
      servicio:      'Tracción',
      revisados:     all.length,
      oportunidades: opors,
      enfriando,
      conAccion,
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
