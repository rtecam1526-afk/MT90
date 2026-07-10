// Semáforo semanal + Mi evolución — nuevas pestañas del CRM

/* ── SEMÁFORO ─────────────────────────────────────────────────────────── */
function Semaforo({ data, done }) {
  const sf = data.semaforo;
  const hechos = Object.values(done || {}).filter(Boolean).length;

  const rows = [
    {
      emoji: "📞",
      titulo: "Llamadas esta semana",
      detalle: `Meta: ${sf.metaSemanal} contactos`,
      valor: hechos,
      estado: hechos >= sf.metaSemanal ? "verde" : hechos >= sf.metaSemanal * 0.65 ? "amarillo" : "rojo",
    },
    {
      emoji: "⏰",
      titulo: "Atrasados (+90 días sin contacto)",
      detalle: "Sin llamar desde hace 3 meses o más",
      valor: sf.atrasados,
      estado: sf.atrasados === 0 ? "verde" : sf.atrasados <= 15 ? "amarillo" : "rojo",
    },
    {
      emoji: "📊",
      titulo: "Cartera al día",
      detalle: "Contactados en los últimos 30 días",
      valor: sf.pctAlDia + "%",
      estado: sf.pctAlDia >= 55 ? "verde" : sf.pctAlDia >= 30 ? "amarillo" : "rojo",
    },
    {
      emoji: "⚡",
      titulo: "Calientes sin próxima acción",
      detalle: "Riesgo de perder el momentum",
      valor: sf.sinFecha,
      estado: sf.sinFecha === 0 ? "verde" : sf.sinFecha <= 3 ? "amarillo" : "rojo",
    },
  ];

  const problemas = rows.filter(r => r.estado === "rojo");
  let insight = "Tu cartera está bien gestionada esta semana. Seguí con el ritmo.";
  if (problemas.length > 0) {
    const p = problemas[0];
    if (p.titulo.includes("Calientes")) {
      insight = `Tenés ${sf.sinFecha} contacto${sf.sinFecha === 1 ? "" : "s"} caliente${sf.sinFecha === 1 ? "" : "s"} sin próxima acción — esos son los que más riesgo tienen de enfriarse antes de cerrar.`;
    } else if (p.titulo.includes("Atrasados")) {
      insight = `${sf.atrasados} contactos llevan más de 90 días sin actividad. Vale la pena revisarlos esta semana y decidir si seguirlos o descartarlos.`;
    } else if (p.titulo.includes("Llamadas")) {
      insight = `Vas ${hechos} de ${sf.metaSemanal} llamadas esta semana. Apuntá a llegar a la meta antes del viernes.`;
    }
  }

  const hoy = new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="sf-wrap fade-in">
      <div className="sf-head">
        <h1 className="sf-title-h">Semáforo semanal</h1>
        <p className="sf-sub">Estado de tu cartera · {hoy}</p>
      </div>

      <div className="sf-rows">
        {rows.map((row, i) => (
          <div className={"sf-row sf-" + row.estado} key={i}>
            <div className={"sf-icon sf-icon-" + row.estado}>{row.emoji}</div>
            <div className="sf-body">
              <div className="sf-rtitle">{row.titulo}</div>
              <div className="sf-rdetail">{row.detalle}</div>
            </div>
            <div className={"sf-val sf-val-" + row.estado}>{row.valor}</div>
          </div>
        ))}
      </div>

      <div className="sf-insight">
        <div className="sf-ilbl">Para esta semana</div>
        <div className="sf-itext">{insight}</div>
      </div>
    </div>
  );
}

/* ── MI EVOLUCIÓN ─────────────────────────────────────────────────────── */
function MiEvolucion({ data }) {
  const sf = data.semaforo;
  const total = data.totalContactos;

  const pct = (v, max) => Math.min(100, Math.round((v / Math.max(max, 1)) * 100));

  const metricas = [
    {
      label: "Cartera al día",
      desc:  "contactados en los últimos 30 días",
      valor: sf.pctAlDia + "%",
      barra: sf.pctAlDia,
      color: sf.pctAlDia >= 55 ? "var(--whatsapp)" : sf.pctAlDia >= 30 ? "#D9912F" : "#C0392B",
    },
    {
      label: "Calientes activos",
      desc:  "con seguimiento vigente (< 30 días)",
      valor: `${sf.calActivos} de ${sf.totalCal}`,
      barra: pct(sf.calActivos, sf.totalCal),
      color: sf.totalCal === 0 || sf.calActivos / sf.totalCal >= 0.6 ? "var(--whatsapp)" : "#D9912F",
    },
    {
      label: "Contactos totales",
      desc:  "en tu cartera",
      valor: total,
      barra: Math.min(100, pct(total, 300)),
      color: "var(--primary)",
    },
  ];

  const cards = [
    { num: sf.pctAlDia + "%", lbl: "Al día" },
    { num: sf.totalCal,       lbl: "Calientes" },
    { num: sf.atrasados,      lbl: "Atrasados" },
  ];

  const msg = sf.pctAlDia >= 55
    ? `El ${sf.pctAlDia}% de tu cartera tiene contacto vigente. Buen ritmo.`
    : `Solo el ${sf.pctAlDia}% de tu cartera tiene contacto en los últimos 30 días. Hay margen para mejorar el ritmo semanal.`;

  const extra = sf.atrasados > 0
    ? ` Hay ${sf.atrasados} contacto${sf.atrasados === 1 ? "" : "s"} con más de 90 días sin actividad.`
    : " No hay contactos abandonados — excelente.";

  return (
    <div className="ev-wrap fade-in">
      <div className="sf-head">
        <h1 className="sf-title-h">Mi evolución</h1>
        <p className="sf-sub">Métricas actuales de tu cartera</p>
      </div>

      <div className="ev-grid">
        {cards.map((c, i) => (
          <div className="ev-card" key={i}>
            <div className="ev-cnum">{c.num}</div>
            <div className="ev-clbl">{c.lbl}</div>
          </div>
        ))}
      </div>

      <div className="ev-sec-label">Detalle</div>

      {metricas.map((m, i) => (
        <div className="ev-bwrap" key={i}>
          <div className="ev-blbl">
            {m.label} <span className="ev-bdesc">— {m.desc}</span>
          </div>
          <div className="ev-bar-row">
            <div className="ev-track">
              <div className="ev-fill" style={{ width: m.barra + "%", background: m.color }}></div>
            </div>
            <span className="ev-bval">{m.valor}</span>
          </div>
        </div>
      ))}

      <div className="sf-insight">
        <div className="sf-ilbl">Lectura de la cartera</div>
        <div className="sf-itext">{msg}{extra}</div>
      </div>
    </div>
  );
}

window.Semaforo    = Semaforo;
window.MiEvolucion = MiEvolucion;
