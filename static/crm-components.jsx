// Shared building blocks for the redesign. Exported to window for cross-file use.
const { useState, useEffect, useRef } = React;

// ---- Plain-language helpers (no jargon) ----
function tiempoSinHablar(dias) {
  if (dias == null) return "Sin fecha de último contacto";
  if (dias < 7) return `Hace ${dias} día${dias === 1 ? "" : "s"}`;
  if (dias < 60) return `Hace ${dias} días`;
  const meses = Math.round(dias / 30);
  if (meses < 12) return `Hace ${meses} meses sin hablar`;
  const años = (dias / 365);
  return `Hace más de ${Math.floor(años)} año${años >= 2 ? "s" : ""} sin hablar`;
}
function esUrgente(dias) { return dias != null && dias > 120; }

// Birthday helpers (cumple stored as "YYYY-MM-DD")
function esCumpleHoy(cumple) {
  if (!cumple) return false;
  const now = new Date();
  const mmdd = String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
  return cumple.slice(5) === mmdd;
}
function formatoCumple(cumple) {
  if (!cumple) return "";
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const [y, m, d] = cumple.split("-");
  return parseInt(d, 10) + " " + meses[parseInt(m, 10) - 1];
}
function mensajeCumple(nombre) {
  const primer = (nombre || "").split(" ")[0];
  return "¡Feliz cumpleaños, " + primer + "! Te deseo un día hermoso. Un fuerte abrazo.";
}

// Date helpers for the weekly framing
const DIAS_SEM = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
function lunesDeEstaSemana() {
  const d = new Date();
  const diff = (d.getDay() + 6) % 7; // days since Monday
  d.setDate(d.getDate() - diff);
  return d;
}
function fechaCorta(d) { return d.getDate() + " de " + MESES[d.getMonth()]; }
function fechaLarga(d) { return DIAS_SEM[d.getDay()] + " " + d.getDate() + " de " + MESES[d.getMonth()]; }

const STAGE = {
  caliente: { label: "Caliente", color: "var(--caliente)", soft: "var(--caliente-soft)" },
  media:    { label: "Media",    color: "var(--media)",    soft: "var(--media-soft)" },
  tibio:    { label: "Tibio",    color: "var(--media)",    soft: "var(--media-soft)" },
  fria:     { label: "Fría",     color: "var(--fria)",     soft: "var(--fria-soft)" },
  sin:      { label: "Sin etapa", color: "var(--sin)",     soft: "var(--sin-soft)" },
};

// Deterministic warm avatar color from initials
const AV_COLORS = ["#E0633A", "#D9912F", "#5E86B8", "#C9587E", "#5BA37A", "#8A6FC4", "#D4663E"];
function avatarColor(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AV_COLORS[h % AV_COLORS.length];
}

function Avatar({ iniciales, className }) {
  return (
    <div className={"avatar " + (className || "")} style={{ background: avatarColor(iniciales || "?") }}>
      {iniciales}
    </div>
  );
}

function StageTag({ etapa }) {
  const s = STAGE[etapa] || STAGE.sin;
  return (
    <span className="stage-tag" style={{ background: s.soft, color: s.color }}>
      <span className="dot" style={{ background: s.color }}></span>
      {s.label}
    </span>
  );
}

// ---- Inline icons (simple, friendly stroke) ----
const Icon = {
  wa: () => (
    <svg className="icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm5.8 14.13c-.25.69-1.45 1.32-1.99 1.4-.53.08-1.02.29-3.42-.71-2.89-1.2-4.74-4.11-4.88-4.3-.14-.19-1.18-1.56-1.18-2.98 0-1.42.75-2.12 1.01-2.41.25-.29.55-.36.74-.36.18 0 .37 0 .53.01.17.01.4-.06.62.48.25.6.85 2.07.92 2.22.07.14.12.31.02.5-.09.19-.14.31-.28.48-.14.17-.29.37-.42.5-.14.14-.28.29-.12.56.16.27.71 1.17 1.53 1.9 1.05.94 1.94 1.23 2.21 1.37.27.14.43.12.59-.07.16-.19.68-.79.86-1.06.18-.27.36-.22.61-.13.25.09 1.59.75 1.86.89.27.14.45.2.52.31.07.12.07.66-.18 1.35Z"/>
    </svg>
  ),
  check: () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5"/>
    </svg>
  ),
  arrow: () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6"/>
    </svg>
  ),
  back: () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 12H5M11 18l-6-6 6-6"/>
    </svg>
  ),
  plus: () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14"/>
    </svg>
  ),
  copy: () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>
    </svg>
  ),
  x: () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18"/>
    </svg>
  ),
  phone: () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z"/>
    </svg>
  ),
  search: () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
    </svg>
  ),
  more: () => (
    <svg className="icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
    </svg>
  ),
  sync: () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12a9 9 0 0 1-9 9 9 9 0 0 1-6.7-3M3 12a9 9 0 0 1 9-9 9 9 0 0 1 6.7 3"/>
      <path d="M21 3v5h-5M3 21v-5h5"/>
    </svg>
  ),
  gear: () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>
    </svg>
  ),
  spark: () => (
    <svg className="icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2c.4 3.3 1.9 4.8 5.2 5.2-3.3.4-4.8 1.9-5.2 5.2-.4-3.3-1.9-4.8-5.2-5.2C10.1 6.8 11.6 5.3 12 2Z"/>
      <path d="M18 13c.25 2 1.15 2.9 3.15 3.15-2 .25-2.9 1.15-3.15 3.15-.25-2-1.15-2.9-3.15-3.15C16.85 15.9 17.75 15 18 13Z"/>
    </svg>
  ),
  gift: () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>
      <path d="M12 8S10.5 3 8 3a2.5 2.5 0 0 0 0 5h4Zm0 0s1.5-5 4-5a2.5 2.5 0 0 1 0 5h-4Z"/>
    </svg>
  ),
  idea: () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 18h6M10 21h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1h6c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2Z"/>
    </svg>
  ),
  cooling: () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 7l6 6 4-4 8 8M21 17v-4h-4"/>
    </svg>
  ),
  target: () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/>
    </svg>
  ),
  deal: () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 17l2 2a1 1 0 0 0 1.4 0l3.6-3.6M4 6h2l3 3M2 13l4 4M22 11l-4 4M6 9l4.5 4.5a1 1 0 0 0 1.4 0l.6-.6 4 4"/>
    </svg>
  ),
  building: () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 8h.01M15 8h.01M9 12h.01M15 12h.01M10 21v-3a2 2 0 0 1 4 0v3"/>
    </svg>
  ),
  key: () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.7 12.3 19 4M16 5l3 3M14 7l2 2"/>
    </svg>
  ),
  flame: () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2c1 4-2 5-2 8a2 2 0 0 0 4 0c0-.7-.2-1.3-.4-1.8C16 9.5 18 12 18 15a6 6 0 0 1-12 0c0-4 3-6 6-13Z"/>
    </svg>
  ),
  pencil: () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>
    </svg>
  ),
  chart: () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 3v18h18"/><rect x="7" y="11" width="3" height="6" rx="1"/><rect x="12" y="7" width="3" height="10" rx="1"/><rect x="17" y="13" width="3" height="4" rx="1"/>
    </svg>
  ),
  message: () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.7-.7L3 21l1.3-4a8.4 8.4 0 0 1-.8-3.6A8.4 8.4 0 0 1 12 4a8.4 8.4 0 0 1 9 7.5Z"/>
    </svg>
  ),
  shield: () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>
    </svg>
  ),
  send: () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z"/>
    </svg>
  ),
  home: () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 10.5 12 3l9 7.5M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5"/>
    </svg>
  ),
  users: () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11"/>
    </svg>
  ),
  building: () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M9 8h.01M15 8h.01M9 12h.01M15 12h.01M10 21v-3a2 2 0 0 1 4 0v3"/>
    </svg>
  ),
  deal: () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5"/><path d="M14 4h6v6"/>
    </svg>
  ),
};

Object.assign(window, {
  tiempoSinHablar, esUrgente, esCumpleHoy, formatoCumple, mensajeCumple,
  lunesDeEstaSemana, fechaCorta, fechaLarga, STAGE, avatarColor, Avatar, StageTag, Icon,
});
