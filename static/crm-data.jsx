// buildCrmData — transforma contactos crudos de Supabase al formato de los componentes.
// Cargado después de crm-components.jsx (necesita tiempoSinHablar, esUrgente).

(function() {

// ── Detección de género por nombre de pila ──────────────────────────────
// Para campañas como "Día de la Madre"/"Día del Padre": la cartera tiene
// contactos cargados "tal cual" desde el teléfono, mezclando personas con
// direcciones de propiedades, inmobiliarias, etc. Mandar un saludo de Día
// de la Madre a todo el mundo (hombres incluidos, o a "COCHERA RAWSON")
// sería un papelón. Se compara la PRIMERA palabra del nombre contra listas
// de nombres argentinos comunes — si no matchea ninguna, se excluye de
// ambas campañas de género (mejor dejar afuera a una madre real que
// incluir a alguien que no corresponde).
var NOMBRES_FEMENINOS = new Set([
  'maria','ana','laura','claudia','valeria','patricia','daniela','paula','sofia','carolina',
  'gabriela','silvia','marcela','alejandra','fernanda','cecilia','natalia','vanesa','vanessa','romina',
  'florencia','lucia','camila','julieta','victoria','agustina','micaela','antonella','brenda','yanina',
  'cintia','mariana','carla','soledad','veronica','andrea','sandra','elizabeth','graciela','liliana',
  'norma','susana','mirta','nora','beatriz','adriana','viviana','monica','griselda','rosa',
  'estela','marta','martha','marisa','noelia','milagros','agostina','abril','catalina','delfina',
  'josefina','martina','emilia','valentina','bianca','ornella','lourdes','rocio','gisela','jazmin',
  'melina','tamara','yesica','jessica','vanina','ines','isabel','teresa','cristina','sonia',
  'dora','elsa','elena','irene','ivana','ivone','yvonne','karina','sabrina','erica',
  'erika','evelyn','evangelina','luciana','mercedes','milena','nadia','nancy','noemi','ivonne',
  'paola','pilar','raquel','sara','sarah','silvina','stella','ximena','yolanda','zulema',
  'alicia','amalia','amanda','angela','angeles','antonia','araceli','azucena','belen','bettina',
  'blanca','carina','carmen','celeste','clara','corina','dalila','débora','debora','diana',
  'dolores','edith','elba','eliana','emma','esther','eugenia','eva','flavia','gimena',
  'guadalupe','guillermina','ileana','ingrid','jacqueline','jaqueline','jimena','johanna','karen','keila',
  'leila','leticia','lia','lidia','lilian','lorena','luisina','luz','magali','magdalena',
  'malena','manuela','margarita','maria jose','maría josé','mariel','marilina','matilde','maximiliana','melisa',
  'melissa','miriam','myriam','nahir','nahiara','nair','nati','natividad','noa','nora',
  'ofelia','olga','oriana','pamela','perla','priscila','rita','rocio','rosana','rosario',
  'ruth','samanta','samantha','selena','selva','shirley','stefania','tatiana','trinidad','vera',
  'virginia','yael','yamila','yesenia','zaira','zoe','abigail','agustina','alba','alma',
  'amelia','ariadna','ayelen','azul','bárbara','barbara','belkis','betiana','bianca','briseida',
  'camila','candela','carlota','celina','cielo','constanza','daiana','dayana','desiree','dominique',
  'eliza','ema','esperanza','estefania','estefanía','faustina','gala','ginebra','giselle','hilda',
  'hortensia','iara','ignacia','iris','isidora','jade','joaquina','juana','julia','justina',
  'kiara','kimberly','lara','leonor','lila','lina','lis','lola','lucero',
  'luján','lujan','luna','madelen','mailen','maite','malvina','marcia','margot','mariana',
  'marianela','maricel','marisol','maru','matilda','melany','meli','mia','miranda','nadina',
  'naiara','nazarena','nerina','nicole','nilda','noa','ofelia','olivia','otilia','palmira',
  'petrona','quimey','regina','renata','rina','rosalia','rosaura','sabina','salome','selene',
  'sheila','sofia','stella maris','sue','tais','taina','tania','tatiana','trinidad','uma',
  'valentina','vilma','wanda','ailen','ailín','anabela','anabella','antonella','araceli','azucena',
  'belen','berenice','bettina','carina','celia','clarisa','constance','cora','dafne','denise',
  'estela','estefi','eufrasia','flor','frida','gladys','greta','helena','herminia','honoria',
  'inés','ivanna','jesica','josefa','juanita','katherine','katia','kenia','lia','lucrecia',
  'guada','grisela','hebe','ianina','male','meli','vicky','noe','euge','cande',
  'fiorella','yamila','griselda','consuelo','clemencia','leonarda','remedios','encarnacion','asuncion','concepcion',
  'maru','pochi','pety','coty','titi','nati','sofi','vale','agos'
]);
var NOMBRES_MASCULINOS = new Set([
  'juan','jose','carlos','jorge','luis','miguel','pedro','pablo','ricardo','roberto',
  'daniel','fernando','diego','martin','sergio','alberto','andres','francisco','gustavo','gabriel',
  'eduardo','mario','raul','oscar','ruben','hector','gonzalo','nicolas','matias','federico',
  'ignacio','cristian','cristian','emanuel','emiliano','ezequiel','facundo','franco','gaston','germán',
  'german','guillermo','hernan','horacio','ivan','javier','joaquin','jonathan','jorge','jose luis',
  'juan carlos','julian','leandro','leonardo','lucas','manuel','marcelo','marcos','maximiliano','nahuel',
  'nestor','pablo','pascual','patricio','rafael','ramiro','ramon','rodrigo','rodolfo','santiago',
  'sebastian','tomas','victor','walter','agustin','alan','alejandro','alexis','ariel','armando',
  'arturo','augusto','axel','bautista','benjamin','bruno','camilo','claudio','damian','dario',
  'david','dario','elias','enzo','esteban','ezequiel','fabian','fabricio','felipe','flavio',
  'gabriel','geronimo','gerónimo','gaspar','gregorio','hugo','ian','isidro','jeremias','joel',
  'jonas','julio','kevin','leonel','lionel','lorenzo','luciano','maximo','máximo','mauricio',
  'mauro','maximiliano','miguel angel','nahuel','nahum','nicanor','norberto','octavio','osvaldo','pedro pablo',
  'rafael','renzo','rene','roman','salvador','samuel','simon','teodoro','thiago','tobias',
  'ulises','valentin','vicente','wenceslao','adolfo','agustín','alan','alcides','alvaro','ángel',
  'angel','anibal','antonio','aquiles','baltazar','bautista','benicio','bernardo','bruno','cesar',
  'cristobal','damian','darian','donato','edgardo','elias','emilio','enrique','erasmo','ernesto',
  'estanislao','felix','fernando','filiberto','florencio','francisco','franco','gerardo','gino','gonzalo',
  'graciano','heraldo','hilario','homero','honorio','ismael','israel','jacinto','jacobo','jeronimo',
  'joaquín','jonatan','jose maria','josé maría','juan ignacio','juan manuel','juan pablo','julian','justo','kevin',
  'leon','luca','lucio','luis alberto','luis maria','mariano','marino','martiniano','mateo','matias',
  'melchor','mijail','milton','nazareno','nehuen','nehuén','nelson','nicasio','noel','norman'
]);

function normalizarNombre(s) {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
function primeraPalabra(nombre) {
  return (nombre || '').trim().split(/\s+/)[0] || '';
}
function pareceMujer(nombreCompleto) {
  return NOMBRES_FEMENINOS.has(normalizarNombre(primeraPalabra(nombreCompleto)));
}
function pareceHombre(nombreCompleto) {
  return NOMBRES_MASCULINOS.has(normalizarNombre(primeraPalabra(nombreCompleto)));
}

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
  // Tibio: ya hay algo concreto hablado, el mensaje retoma ESO puntual —
  // no es un "¿cómo andás?" genérico, es seguimiento de lo último que dijo.
  if (c.etapa === 'media')
    return `Hola ${primer}! Te escribo para retomar lo de ${nec} — ¿en qué quedamos la última vez? ¿Seguís con esos planes?`;
  // Frío: retomar "lo de siempre" ya no funcionó, necesita un gancho nuevo
  // para reabrir la conversación, no otro recordatorio de lo mismo.
  if (c.etapa === 'fria')
    return `Hola ${primer}! Soy ${agente}. Hace un tiempo que no hablamos de ${nec} — surgió algo nuevo en la zona que te puede interesar, ¿te cuento?`;
  return `Hola ${primer}! Soy ${agente}. ¿Seguís con interés en ${nec}?`;
}

// Genera campañas de fechas especiales argentinas
function buildCampanas(contacts, agente, contactsMujeres, contactsHombres) {
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
    { id: 'padre',         titulo: 'Día del Padre',       fecha: toISO(nthWeekday(year, 5, 0, 3)), genero: 'hombre' },
    { id: 'independencia', titulo: '9 de Julio',          fecha: `${year}-07-09` },
    { id: 'amigo',         titulo: 'Día del Amigo',       fecha: `${year}-07-20` },
    { id: 'maestra',       titulo: 'Día del Maestro',     fecha: `${year}-09-11` },
    { id: 'primavera',     titulo: 'Día de la Primavera', fecha: `${year}-09-21` },
    { id: 'madre',         titulo: 'Día de la Madre',     fecha: toISO(nthWeekday(year, 9, 0, 3)), genero: 'mujer' },
    { id: 'navidad',       titulo: 'Navidad',             fecha: `${year}-12-25` },
    { id: 'anonuevo',      titulo: 'Año Nuevo',           fecha: `${year+1}-01-01` },
  ]
    .map(f => {
      const diff = Math.round((new Date(f.fecha) - now) / 86400000);
      const alcanceLista = f.genero === 'mujer' ? contactsMujeres : f.genero === 'hombre' ? contactsHombres : contacts;
      return {
        ...f, enDias: diff, alcance: alcanceLista.length,
        mensaje: `¡Feliz ${f.titulo}, NOMBRE! Un saludo grande de mi parte. — ${agente}`,
      };
    })
    .filter(f => f.enDias >= 0)
    .sort((a, b) => a.enDias - b.enDias);

  const proxima = fechas[0] || {
    id: 'generic', titulo: 'Año Nuevo', fecha: `${year+1}-01-01`, enDias: 30, alcance: contacts.length,
    mensaje: `¡Feliz Año Nuevo, NOMBRE! Un saludo de ${agente}.`,
  };

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
      actualizadoEl:    c.updated_at || c.created_at || null,
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
  // Cartera se ordena por actualización más reciente primero (no por
  // urgencia como "Hoy"/"Mi semana") — así se ve de un vistazo qué se tocó
  // hace poco, sea quien sea que lo haya actualizado.
  const byEtapaReciente = k => all
    .filter(c => c.etapa === k)
    .slice()
    .sort((a, b) => new Date(b.actualizadoEl || 0) - new Date(a.actualizadoEl || 0));

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
  const carteraQueue = all.filter(c => c.telefono && c.telefono.trim());
  // Para campañas de género (Día de la Madre/Padre) — ver pareceMujer/pareceHombre
  // más arriba. Lo que no matchea ningún nombre conocido queda afuera de las dos
  // (mejor excluir de más que mandarle "Feliz día de la madre" a un hombre o a
  // una dirección cargada como contacto).
  const carteraQueueMujeres = carteraQueue.filter(c => pareceMujer(c.nombre));
  const carteraQueueHombres = carteraQueue.filter(c => pareceHombre(c.nombre));
  // Versión SIN filtrar por teléfono, solo para el conteo de "alcance" — así
  // se mantiene el aviso de "tantos contactos no tienen teléfono cargado"
  // también en las campañas de género (si no, el total ya vendría pre-filtrado
  // y ese aviso nunca aparecería).
  const todasMujeres = all.filter(c => pareceMujer(c.nombre));
  const todosHombres = all.filter(c => pareceHombre(c.nombre));

  // Semáforo & evolución — métricas derivadas de la cartera actual
  const calAll         = byEtapa('caliente');
  const atrasados90    = all.filter(c => c.diasSinContacto != null && c.diasSinContacto > 90);
  const contactados30d = all.filter(c => c.diasSinContacto != null && c.diasSinContacto < 30);
  const calActivos     = calAll.filter(c => c.diasSinContacto != null && c.diasSinContacto < 30).length;
  const sinFechaCount  = calAll.filter(c => !c.proximaAccion || !c.proximaAccion.trim()).length;
  const pctAlDia       = all.length > 0 ? Math.round((contactados30d.length / all.length) * 100) : 0;
  const hablados       = Object.values(done || {}).filter(Boolean).length;
  const metaSemanal    = Math.max(10, Math.min(20, Math.ceil(hoy.length * 0.35)));
  const semaforo = {
    atrasados:    atrasados90.length,
    sinFecha:     sinFechaCount,
    hablados,
    metaSemanal,
    pctAlDia,
    contactados30d: contactados30d.length,
    calActivos,
    totalCal:     calAll.length,
  };

  // Contactos con próxima acción definida, ordenados por urgencia
  const conAccion = all
    .filter(c => c.proximaAccion && c.proximaAccion.trim())
    .slice(0, 15);

  return {
    agente,
    totalContactos: all.length,
    hoy,
    cartera: {
      caliente: byEtapaReciente('caliente'),
      media:    byEtapaReciente('media'),
      fria:     byEtapaReciente('fria'),
      sin:      byEtapaReciente('sin'),
    },
    campanas:     buildCampanas(all, agente, todasMujeres, todosHombres),
    carteraQueue,
    carteraQueueMujeres,
    carteraQueueHombres,
    semaforo,
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
