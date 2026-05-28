#!/usr/bin/env python3
"""
MT90 Tracción — Agente IA
Asistente de captación para agentes Remax
"""

import os, json, glob, uuid, re, time, datetime
from functools import wraps
from flask import Flask, request, Response, render_template, session, redirect, url_for
import anthropic
import requests as _req
import config_ia as cfg
import acm_scraper

SUPABASE_URL  = os.environ.get("SUPABASE_URL", "").strip()
SUPABASE_KEY  = os.environ.get("SUPABASE_KEY", "").strip()
RADAR_TOKEN   = os.environ.get("RADAR_TOKEN", "mt90_radar_2024").strip()

def _supa_hdrs():
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "mt90_traccion_secret_2024")

client = anthropic.Anthropic(api_key=cfg.ANTHROPIC_API_KEY, max_retries=3)

# Historial en memoria (app local, un solo usuario)
_historiales = {}   # session_id -> list of messages
_agentes     = {}   # session_id -> agente_key
_ultimo_acm  = {}   # session_id -> {barrio, tipo, m2, ambientes, contenido, agente_nombre}
_radar_cache = {}   # agente_key -> {contenido, nombre}


def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get("loggeado"):
            return redirect(url_for("login"))
        return f(*args, **kwargs)
    return decorated


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        email    = (request.form.get("email")    or "").strip().lower()
        password = (request.form.get("password") or "").strip()
        for key, ag in cfg.AGENTES.items():
            if ag["email"].lower() == email and ag["password"] == password:
                session["loggeado"]   = True
                session["agente_key"] = key
                sid = get_sid()
                _agentes[sid] = key
                return redirect(url_for("crm"))
        return render_template("login.html", error="Email o contraseña incorrectos.")
    if session.get("loggeado"):
        return redirect(url_for("index"))
    return render_template("login.html", error=None)


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


def get_sid():
    if "sid" not in session:
        session["sid"] = str(uuid.uuid4())
    return session["sid"]


_RADAR_DIR = os.path.join(os.path.dirname(__file__), "_radar_disk")
os.makedirs(_RADAR_DIR, exist_ok=True)


def _radar_disk_path(agente_key: str) -> str:
    return os.path.join(_RADAR_DIR, f"{agente_key}.json")


def cargar_radar_hoy(agente_key: str = "") -> str:
    hoy = datetime.date.today().isoformat()
    # 1. Memoria (más rápido)
    if agente_key and agente_key in _radar_cache:
        cache = _radar_cache[agente_key]
        if cache.get("fecha") == hoy:
            return f"\n\n[RADAR DE HOY — {cache['nombre']}]\n{cache['contenido'][:3000]}"
    # 2. Disco (sobrevive sleep de Render)
    if agente_key:
        path = _radar_disk_path(agente_key)
        if os.path.exists(path):
            try:
                with open(path, encoding="utf-8") as f:
                    data = json.load(f)
                if data.get("fecha") == hoy:
                    _radar_cache[agente_key] = data
                    return f"\n\n[RADAR DE HOY — {data['nombre']}]\n{data['contenido'][:3000]}"
            except Exception:
                pass
    # 3. Fallback: archivos locales (solo cuando corre en la misma máquina)
    radar_dir = os.path.join(os.path.dirname(__file__), "..", "radar_captacion")
    archivos = []
    for patron in ["radar_facebook_email.html", "radar_email.html", "radar_*.html"]:
        archivos.extend(glob.glob(os.path.join(radar_dir, patron)))
    if not archivos:
        return ""
    archivos.sort(key=os.path.getmtime, reverse=True)
    try:
        with open(archivos[0], encoding="utf-8") as f:
            contenido = f.read()
        texto = re.sub(r'<style[^>]*>.*?</style>', '', contenido, flags=re.DOTALL)
        texto = re.sub(r'<[^>]+>', ' ', texto)
        texto = re.sub(r'\s+', ' ', texto).strip()
        nombre = os.path.basename(archivos[0])
        return f"\n\n[RADAR DE HOY — {nombre}]\n{texto[:3000]}"
    except Exception:
        return ""


@app.route("/upload_radar", methods=["POST"])
def upload_radar():
    data    = request.get_json()
    token   = data.get("token", "")
    if token != RADAR_TOKEN:
        return {"error": "No autorizado"}, 401
    agente   = data.get("agente", "")
    html     = data.get("html", "")
    nombre   = data.get("nombre", "radar.html")
    if not agente or not html:
        return {"error": "Faltan datos"}, 400
    texto = re.sub(r'<style[^>]*>.*?</style>', '', html, flags=re.DOTALL)
    texto = re.sub(r'<[^>]+>', ' ', texto)
    texto = re.sub(r'\s+', ' ', texto).strip()
    hoy = datetime.date.today().isoformat()
    entry = {"contenido": texto, "nombre": nombre, "fecha": hoy}
    _radar_cache[agente] = entry
    # Persistir en disco para sobrevivir sleep de Render
    try:
        with open(_radar_disk_path(agente), "w", encoding="utf-8") as f:
            json.dump(entry, f, ensure_ascii=False)
    except Exception as e:
        print(f"[RADAR] No se pudo guardar en disco: {e}")
    return {"ok": True, "agente": agente, "fecha": hoy, "chars": len(texto)}


_SUPA_INJECT = r"""
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
/* ================================================================
   AURORA CRM OVERRIDE  —  injected into legacy McKinsey CRM HTML
   bg #f6f6fa · white #ffffff · accent #5b5ee0 · ink #1a1830
   ================================================================ */

/* ── Global tokens ── */
:root {
  --mp-paper:  #f6f6fa !important;
  --mp-ink:    #1a1830 !important;
  --mp-ink2:   #4a4861 !important;
  --mp-rule:   #ececf3 !important;
  --mp-mute:   #76748a !important;
  --mp-mute2:  #8b89a4 !important;
  --mp-accent: #5b5ee0 !important;
  --mp-gold:   #f59e0b !important;
  --mp-serif:  "Inter",system-ui,sans-serif !important;
  --mp-sans:   "Inter",system-ui,sans-serif !important;
  --mp-mono:   "Inter",system-ui,sans-serif !important;
  --bg:#f6f6fa !important; --sf:#ffffff !important; --sf2:#f4f3fb !important;
  --br:#ececf3 !important; --tx:#1a1830 !important;
  --mu:#76748a !important; --mu2:#8b89a4 !important;
  --ac:#5b5ee0 !important; --ach:#3a3ad0 !important; --acl:rgba(91,94,224,.07) !important;
  --navy:#1a1830 !important; --navy2:#0f0d26 !important;
  --navybr:#ececf3 !important;
  --agent-dot:#5b5ee0 !important; --agent-solid:#5b5ee0 !important;
}
body { font-family:"Inter",system-ui,sans-serif !important; background:#f6f6fa !important; }

/* ── Topbar ── */
.topbar { background:#ffffff !important; border-bottom:1px solid #ececf3 !important; }
.topbar-logo,.topbar-logo .logo-m90 { color:#1a1830 !important; }
.topbar-logo .logo-traccion { color:#5b5ee0 !important; font-family:"Inter",sans-serif !important; letter-spacing:0 !important; }
.topbar-agent { color:#76748a !important; font-family:"Inter",sans-serif !important; letter-spacing:0 !important; }
.topbar-sep { background:#ececf3 !important; }
.sync-badge { color:#76748a !important; font-family:"Inter",sans-serif !important; letter-spacing:0 !important; }
.sync-dot { background:#5b5ee0 !important; }
.sync-dot.loading { background:#f59e0b !important; }
.sync-dot.error   { background:#ef4444 !important; }
.topbar-search {
  background:#f6f6fa !important; border:1px solid #ececf3 !important; border-radius:8px !important;
}
.topbar-search input { color:#1a1830 !important; font-family:"Inter",sans-serif !important; }
.topbar-search input::placeholder { color:#8b89a4 !important; }
.topbar-search svg { color:#76748a !important; opacity:1 !important; }
.topbar-search:focus-within { border-color:#5b5ee0 !important; box-shadow:0 0 0 3px #ecebfb !important; }
.shortcut { color:#76748a !important; background:#f6f6fa !important; border-color:#ececf3 !important; border-radius:4px !important; }
.btn-topbar {
  background:#f6f6fa !important; border:1px solid #ececf3 !important; color:#4a4861 !important;
  font-family:"Inter",sans-serif !important; text-transform:none !important;
  letter-spacing:0 !important; font-size:.78rem !important; border-radius:7px !important;
}
.btn-topbar:hover { background:#ecebfb !important; border-color:#5b5ee0 !important; color:#3a3ad0 !important; }
.daily-badge { background:#f6f6fa !important; border-color:#ececf3 !important; color:#4a4861 !important; border-radius:7px !important; }
.daily-badge:hover { background:#ecebfb !important; }
.btn-resumen { background:#f6f6fa !important; border:1px solid #ececf3 !important; color:#4a4861 !important; font-family:"Inter",sans-serif !important; font-size:.78rem !important; border-radius:7px !important; text-transform:none !important; letter-spacing:0 !important; }
.btn-resumen:hover { background:#ecebfb !important; border-color:#5b5ee0 !important; color:#3a3ad0 !important; }

/* ── Sidebar ── */
.sidebar { background:#ffffff !important; border-right:1px solid #ececf3 !important; }
.sidebar::-webkit-scrollbar-thumb { background:#ececf3 !important; }
.nav-section-label { color:#8b89a4 !important; font-family:"Inter",sans-serif !important; letter-spacing:0 !important; font-size:.63rem !important; font-weight:600 !important; }
.nav-item { color:#4a4861 !important; border-left-color:transparent !important; font-family:"Inter",sans-serif !important; text-transform:none !important; letter-spacing:0 !important; }
.nav-item:hover { background:#f4f3fb !important; color:#1a1830 !important; }
.nav-item.active { background:#ecebfb !important; border-left-color:#5b5ee0 !important; color:#3a3ad0 !important; font-weight:600 !important; }
.nav-badge { background:#f4f3fb !important; color:#8b89a4 !important; border-radius:999px !important; }
.nav-item.active .nav-badge { background:#ecebfb !important; color:#5b5ee0 !important; font-weight:600 !important; }
.kpi-label { color:#76748a !important; font-family:"Inter",sans-serif !important; }
.kpi-num { color:#1a1830 !important; }
.kpi-item { border-left-color:transparent !important; }
.kpi-item:hover { background:#f4f3fb !important; }
.kpi-item.active { background:#ecebfb !important; border-left-color:#5b5ee0 !important; }
.kpi-item.kr .kpi-num { color:#ef4444 !important; }
.kpi-item.ko .kpi-num { color:#f59e0b !important; }
.kpi-item.ky .kpi-num { color:#b07815 !important; }
.kpi-item.kg .kpi-num { color:#5b5ee0 !important; }
.fb { color:#4a4861 !important; border-left-color:transparent !important; font-family:"Inter",sans-serif !important; text-transform:none !important; letter-spacing:0 !important; }
.fb:hover { background:#f4f3fb !important; color:#1a1830 !important; }
.fb.on { background:#ecebfb !important; border-left-color:#5b5ee0 !important; color:#3a3ad0 !important; font-weight:600 !important; }
.fb .cnt { background:#f4f3fb !important; color:#8b89a4 !important; border-radius:999px !important; }
.fb.on .cnt { background:#ecebfb !important; color:#5b5ee0 !important; }
.sidebar-stats { border-top:1px solid #ececf3 !important; }
.sstat { color:#8b89a4 !important; font-family:"Inter",sans-serif !important; }
.sstat span { color:#4a4861 !important; }
.btn-reset { background:#f6f6fa !important; border:1px solid #ececf3 !important; color:#76748a !important; font-family:"Inter",sans-serif !important; font-size:.74rem !important; border-radius:6px !important; padding:5px 12px !important; }
.btn-reset:hover { background:#ecebfb !important; color:#3a3ad0 !important; }

/* ── Main ── */
.main-content,.view-container,main,.main { background:#f6f6fa !important; }

/* ── Aurora greeting header (compacto) ── */
#aurora-greet { flex-shrink:0; padding:10px 20px 8px !important; }

/* ── Stats Row → Aurora KPI cards (inline compacto) ── */
.stats-row {
  display:flex !important; flex-wrap:nowrap !important; gap:8px !important;
  padding:10px 20px !important;
  background:#f6f6fa !important; border-bottom:1px solid #ececf3 !important;
}
.stat-pill {
  background:#ffffff !important;
  border:1px solid #ececf3 !important;
  border-radius:8px !important; padding:10px 16px !important;
  min-width:0 !important; flex:1 1 0 !important;
  flex-direction:row !important; align-items:center !important; gap:10px !important;
  box-shadow:0 1px 3px rgba(26,24,48,.05) !important;
  overflow:visible !important; transition:box-shadow .15s !important;
}
.stat-pill:hover { box-shadow:0 3px 10px rgba(26,24,48,.09) !important; }
.stat-pill::after { display:none !important; }
.stat-pill.sp-blue  { border-left:3px solid #94a3b8 !important; }
.stat-pill.sp-red   { border-left:3px solid #ef4444 !important; }
.stat-pill.sp-amber { border-left:3px solid #f59e0b !important; }
.stat-pill.sp-green { border-left:3px solid #5b5ee0 !important; }
.stat-pill .num {
  font-family:"Inter",sans-serif !important; font-size:1.45rem !important;
  font-weight:700 !important; line-height:1 !important; letter-spacing:-.03em !important;
  color:#1a1830 !important; flex-shrink:0 !important;
}
.stat-pill.sp-red   .num { color:#ef4444 !important; }
.stat-pill.sp-amber .num { color:#f59e0b !important; }
.stat-pill.sp-green .num { color:#5b5ee0 !important; }
.stat-pill .lbl {
  font-family:"Inter",sans-serif !important; font-size:.71rem !important;
  font-weight:500 !important; text-transform:none !important; letter-spacing:0 !important;
  color:#76748a !important; margin-top:0 !important;
}

/* ── Llamar hoy — fila horizontal compacta ── */
.hoy-section { background:#ffffff !important; border-bottom:1px solid #ececf3 !important; padding:8px 20px !important; flex-shrink:0 !important; }
.hoy-title { font-family:"Inter",sans-serif !important; font-size:.68rem !important; font-weight:600 !important; text-transform:uppercase !important; letter-spacing:.1em !important; color:#5b5ee0 !important; margin-bottom:7px !important; }
.hoy-title::after { display:none !important; }
.hoy-cards { gap:6px !important; flex-wrap:nowrap !important; align-items:stretch !important; }
/* Cada card es horizontal: avatar · nombre · días · WA · Contacte */
.hoy-card {
  display:flex !important; flex-direction:row !important;
  align-items:center !important; gap:8px !important;
  background:#f6f6fa !important; border:1px solid #ececf3 !important;
  border-radius:8px !important; padding:7px 12px !important;
  width:auto !important; flex-shrink:0 !important;
  cursor:pointer !important; transition:all .12s !important;
  white-space:nowrap !important;
}
.hoy-card:hover { border-color:#d8d6f4 !important; background:#ffffff !important; box-shadow:0 1px 6px rgba(91,94,224,.09) !important; }
.hoy-card.selected { border-color:#5b5ee0 !important; background:#f4f3fb !important; }
/* Avatar inline */
.av-c { margin-bottom:0 !important; flex-shrink:0 !important; }
.hoy-card-name { font-family:"Inter",sans-serif !important; font-size:.84rem !important; font-weight:600 !important; color:#1a1830 !important; margin-bottom:0 !important; white-space:nowrap !important; }
.hoy-card-info { display:none !important; }
.hoy-card-dias { font-family:"Inter",sans-serif !important; font-size:.66rem !important; font-weight:600 !important; letter-spacing:0 !important; text-transform:none !important; padding:2px 7px !important; border-radius:999px !important; margin-bottom:0 !important; white-space:nowrap !important; }
.hoy-card-dias.r { border-color:rgba(239,68,68,.35) !important; color:#dc2626 !important; background:rgba(239,68,68,.06) !important; }
.hoy-card-dias.o { border-color:rgba(245,158,11,.4) !important; color:#b45309 !important; background:rgba(245,158,11,.06) !important; }
.hoy-card-dias.y { border-color:rgba(245,158,11,.35) !important; color:#b45309 !important; background:rgba(245,158,11,.05) !important; }
.hoy-card-dias.g { border-color:rgba(91,94,224,.3) !important; color:#3a3ad0 !important; background:rgba(91,94,224,.06) !important; }
.hoy-card-actions { display:flex !important; gap:4px !important; margin:0 !important; flex-shrink:0 !important; }
.btn-wa-sm { background:#dcfce7 !important; border:1px solid #bbf7d0 !important; color:#15803d !important; padding:3px 8px !important; font-family:"Inter",sans-serif !important; font-size:.66rem !important; font-weight:600 !important; text-transform:none !important; letter-spacing:0 !important; border-radius:5px !important; white-space:nowrap !important; }
.btn-wa-sm:hover { background:#bbf7d0 !important; }
.btn-cont-sm { flex:0 0 auto !important; background:#1a1830 !important; border:none !important; color:#fff !important; padding:3px 10px !important; border-radius:5px !important; font-family:"Inter",sans-serif !important; font-size:.7rem !important; font-weight:600 !important; text-transform:none !important; letter-spacing:0 !important; cursor:pointer !important; white-space:nowrap !important; }
.btn-cont-sm:hover:not(:disabled) { background:#5b5ee0 !important; }
.btn-cont-sm.done { background:#ecebfb !important; color:#5b5ee0 !important; cursor:default !important; }

/* ── Sin historial — oculto por defecto (demasiados chips) ── */
.sinh-section { display:none !important; }

/* ── Filter bar ── */
.filter-bar { background:#f6f6fa !important; border-bottom:1px solid #ececf3 !important; padding:8px 20px !important; }
.rc { font-family:"Inter",sans-serif !important; letter-spacing:0 !important; color:#76748a !important; font-size:.76rem !important; }
.filter-select { background:#ffffff !important; border:1px solid #ececf3 !important; border-radius:6px !important; padding:5px 10px !important; font-family:"Inter",sans-serif !important; font-size:.76rem !important; color:#1a1830 !important; outline:none !important; }
.filter-select:focus { border-color:#5b5ee0 !important; }
.view-toggle { border-color:#ececf3 !important; border-radius:7px !important; overflow:hidden !important; }
.vt-btn { font-family:"Inter",sans-serif !important; font-size:.72rem !important; text-transform:none !important; letter-spacing:0 !important; color:#76748a !important; background:#ffffff !important; }
.vt-btn.active { background:#5b5ee0 !important; color:#ffffff !important; border-right-color:#5b5ee0 !important; }

/* ── Sidebar más angosta para ganar espacio al kanban ── */
.sidebar { width:190px !important; min-width:190px !important; }

/* ── Kanban column headers → Aurora ── */
.kanban-section { background:#f6f6fa !important; }
.kanban-wrap { padding:10px 12px !important; gap:8px !important; }
.kanban-col { width:210px !important; }
.kanban-col { border-radius:8px !important; overflow:hidden !important; }
.col-header {
  background:#ffffff !important;
  border-left:1px solid #ececf3 !important;
  border-right:1px solid #ececf3 !important;
  border-bottom:1px solid #ececf3 !important;
  /* border-top: colored stripe comes from inline style in renderKanban */
  padding:10px 12px !important;
}
.col-title { font-family:"Inter",sans-serif !important; font-size:.88rem !important; font-weight:600 !important; color:#1a1830 !important; letter-spacing:0 !important; }
.col-dot { width:8px !important; height:8px !important; border-radius:50% !important; }
.col-count { background:#f4f3fb !important; color:#5b5ee0 !important; border:none !important; border-radius:999px !important; font-family:"Inter",sans-serif !important; font-size:.7rem !important; font-weight:600 !important; padding:2px 8px !important; }
.col-cards { background:#f6f6fa !important; border:1px solid #ececf3 !important; border-top:none !important; border-radius:0 !important; }
.col-empty { font-family:"Inter",sans-serif !important; font-size:.72rem !important; letter-spacing:0 !important; color:#8b89a4 !important; text-transform:none !important; }

/* ── Kanban cards ── */
.card { background:#ffffff !important; border:1px solid #ececf3 !important; border-radius:8px !important; padding:10px 12px !important; transition:all .15s !important; }
.card:hover { border-color:#d8d6f4 !important; box-shadow:0 2px 6px rgba(91,94,224,.08) !important; }
.card.selected { border-color:#5b5ee0 !important; background:#f4f3fb !important; }
.card.atrasado { border-left:3px solid #ef4444 !important; }
.card-top { display:flex !important; align-items:center !important; gap:6px !important; justify-content:space-between !important; }
.card-name { font-family:"Inter",sans-serif !important; font-size:.86rem !important; font-weight:600 !important; color:#1a1830 !important; }
.card-action { font-family:"Inter",sans-serif !important; font-style:normal !important; font-size:.76rem !important; color:#4a4861 !important; margin-top:4px !important; }
.card-footer { margin-top:8px !important; }
.card-date { font-family:"Inter",sans-serif !important; font-size:.68rem !important; background:#f4f3fb !important; color:#76748a !important; border-radius:999px !important; padding:1px 7px !important; border:none !important; }
.logro-badge { font-family:"Inter",sans-serif !important; font-size:.66rem !important; font-weight:600 !important; border-radius:999px !important; letter-spacing:0 !important; padding:2px 8px !important; text-transform:none !important; }
.badge { font-family:"Inter",sans-serif !important; font-size:.66rem !important; letter-spacing:0 !important; border-radius:999px !important; padding:2px 8px !important; }

/* ── Detail panel ── */
.detail { background:#ffffff !important; border-left:1px solid #ececf3 !important; }
.detail-name { font-family:"Inter",sans-serif !important; color:#1a1830 !important; }
.detail-cont-btn { background:#5b5ee0 !important; border-radius:8px !important; font-family:"Inter",sans-serif !important; text-transform:none !important; letter-spacing:0 !important; }
.detail-cont-btn:hover { background:#3a3ad0 !important; }
.detail-cont-btn.done { background:#ecebfb !important; color:#5b5ee0 !important; }

/* ── Modals ── */
.briefing-header { border-bottom:2px solid #1a1830 !important; }
.resultado-overlay { background:rgba(26,24,48,.45) !important; }
.resultado-modal { border-radius:12px 12px 0 0 !important; }
.res-titulo { color:#76748a !important; }

/* ── Accent overrides (McKinsey green → Aurora indigo) ── */
[style*="background:#86bc25"],[style*="background: #86bc25"] { background:#5b5ee0 !important; }
[style*="color:#86bc25"],[style*="color: #86bc25"] { color:#5b5ee0 !important; }
[style*="color:#c8e87a"],[style*="color: #c8e87a"] { color:#ecebfb !important; }
[style*="border-color:#86bc25"] { border-color:#5b5ee0 !important; }
</style>

<script>
(function(){
  /* ── Data helpers ── */
  function fmtFecha(d){var m=d.getMonth()+1,day=d.getDate(),y=d.getFullYear();return day+'/'+m+'/'+y;}
  function fromSupa(c){
    var nombre=c.nombre||c.cliente||'';
    var fuc=c.fecha_ultimo_contacto||'';
    var dias=parseDias(fuc);
    var pl=prioFromDias(dias);
    var etapa=c.etapa?normEtapa(c.etapa):computeEtapa({etapa:'',prioridad:pl[0],dias_desde_contacto:dias});
    var tel=c.telefono||'';
    var waUrl=c.whatsapp_link||buildWaUrl(tel,'');
    return {
      id:c.id,nombre:nombre,nombre_corto:nombre.split(' ')[0],
      telefono:tel,whatsapp_link:waUrl,whatsapp_url:waUrl,
      antecedente:c.antecedente||'',necesidad:c.necesidad||'',
      profesion:c.profesion||'',grupo_familiar:c.grupo_familiar||'',
      religion:c.religion||'',proxima_accion:c.proxima_accion||'',
      observaciones:c.observaciones||'',referido:'',
      fecha_ultimo_contacto:fuc,fecha_proxima:c.fecha_proxima_accion||'',
      fecha_nacimiento:c.fecha_cumpleanos||'',
      logros:(c.logros||'Sin Avance').trim()||'Sin Avance',
      etapa:etapa,tipo:normTipo(c.tipo||''),
      alerta:c.alerta||(dias===null?'SIN FECHA':dias>30?'ATRASADO':''),
      dias_desde_contacto:dias,prioridad:pl[0],prioridad_color:pl[1],scripts:[],
    };
  }

  /* ── Avatar helpers ── */
  function avIni(nm){var p=(nm||'').trim().split(' ');return((p[0]||'')[0]||'').toUpperCase()+((p[1]||'')[0]||'').toUpperCase();}
  function avBg(nm){
    var pal=['#ef4444','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ec4899','#06b6d4','#5b5ee0'];
    var h=0,s=nm||'';for(var i=0;i<s.length;i++)h=s.charCodeAt(i)+((h<<5)-h);
    return pal[Math.abs(h)%pal.length];
  }
  var AV_STYLE='width:{S}px;height:{S}px;border-radius:50%;background:{C};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:{F};flex-shrink:0';

  /* ── Patch renderHoy: inject avatar circles ── */
  if(typeof window.renderHoy==='function'){
    var _rh=window.renderHoy;
    window.renderHoy=function(){
      _rh.call(this);
      document.querySelectorAll('#hoyCards .hoy-card').forEach(function(card){
        if(card.querySelector('.av-c'))return;
        var ne=card.querySelector('.hoy-card-name');if(!ne)return;
        var nm=ne.textContent.trim();
        var av=document.createElement('div');
        av.className='av-c';
        av.style.cssText=AV_STYLE.replace('{S}','26').replace('{C}',avBg(nm)).replace('{F}','.66rem');
        av.textContent=avIni(nm);
        card.insertBefore(av,card.firstChild);
      });
    };
  }

  /* ── Patch renderKanban: add avatar dots + merge Media/Tibio for Gabriela ── */
  if(typeof window.renderKanban==='function'){
    var _rk=window.renderKanban;
    window.renderKanban=function(arr){
      _rk.call(this,arr);
      document.querySelectorAll('.card-top').forEach(function(top){
        if(top.querySelector('.av-d'))return;
        var ne=top.querySelector('.card-name');if(!ne)return;
        var nm=ne.textContent.trim();
        var av=document.createElement('div');
        av.className='av-d';
        av.style.cssText=AV_STYLE.replace('{S}','22').replace('{C}',avBg(nm)).replace('{F}','.6rem');
        av.textContent=avIni(nm);
        top.insertBefore(av,ne);
      });
      /* Merge Media + Tibio columns for Gabriela */
      if(window._AGENTE_KEY==='gabriela'){
        var mediaCol=null,tibioCol=null;
        document.querySelectorAll('.kanban-col').forEach(function(col){
          var t=col.querySelector('.col-title');
          if(!t)return;
          var txt=t.textContent.trim();
          if(txt==='Media')mediaCol=col;
          if(txt==='Tibio')tibioCol=col;
        });
        if(mediaCol&&tibioCol){
          var tc=tibioCol.querySelector('.col-cards');
          var mc=mediaCol.querySelector('.col-cards');
          if(tc&&mc){while(tc.firstChild)mc.appendChild(tc.firstChild);}
          var mT=mediaCol.querySelector('.col-title');
          if(mT)mT.textContent='Media / Tibio';
          var mCnt=mediaCol.querySelector('.col-count');
          var tCnt=tibioCol.querySelector('.col-count');
          if(mCnt&&tCnt)mCnt.textContent=(parseInt(mCnt.textContent)||0)+(parseInt(tCnt.textContent)||0);
          tibioCol.style.display='none';
        }
      }
    };
  }

  /* ── Greeting header ── */
  (function(){
    var DIAS=['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
    var MESES=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    var d=new Date();
    var fecha=DIAS[d.getDay()]+' · '+d.getDate()+' de '+MESES[d.getMonth()];
    var agEl=document.querySelector('.topbar-agent');
    var agName=agEl?agEl.textContent.split('·')[0].trim():'';
    var greet=agName?'Buenos días, <span style="color:#5b5ee0">'+agName+'</span>':'Bienvenida';
    var div=document.createElement('div');
    div.id='aurora-greet';
    div.style.cssText='padding:8px 20px;background:#ffffff;border-bottom:1px solid #ececf3;flex-shrink:0;display:flex;align-items:center;gap:16px';
    div.innerHTML='<div style="font-family:Inter,sans-serif;font-size:.66rem;font-weight:600;text-transform:uppercase;letter-spacing:.1em;color:#8b89a4">'+fecha+'</div>'
      +'<div style="font-family:Inter,sans-serif;font-size:.95rem;font-weight:700;color:#1a1830">'+greet+'</div>';
    var main=document.querySelector('main.main')||document.querySelector('.main');
    if(main&&!document.getElementById('aurora-greet'))main.insertBefore(div,main.firstChild);
  })();

  /* ── Supabase loader ── */
  function cargarDesdeSupabase(){
    setSyncState('loading','Conectando...');
    fetch('/contactos',{credentials:'same-origin'})
      .then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json();})
      .then(function(rows){
        DATA=rows.map(fromSupa);
        setSyncState('ok','Supabase ● '+new Date().toLocaleTimeString('es-AR')+' — '+DATA.length+' contactos');
        actualizarUI();
        setTimeout(mostrarBriefing,400);
      })
      .catch(function(err){setSyncState('error','Error Supabase: '+err.message);});
  }

  /* ── Patch guardarResultado → Supabase PUT ── */
  var _guardarOrig=window.guardarResultado;
  window.guardarResultado=function(resultado){
    var idx=selectedResultIdx;
    _guardarOrig(resultado);
    if(idx>=0&&DATA[idx]&&DATA[idx].id){
      fetch('/contactos/'+DATA[idx].id,{
        method:'PUT',credentials:'same-origin',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({fecha_ultimo_contacto:fmtFecha(new Date()),logros:resultado})
      });
    }
  };

  /* ── "+ Contacto" button ── */
  var btnN=document.createElement('button');
  btnN.className='btn-topbar';
  btnN.innerHTML='+ Contacto';
  btnN.style.cssText='background:#ecebfb;border-color:#d8d6f4;color:#3a3ad0;font-weight:600;font-family:Inter,system-ui,sans-serif';
  btnN.onmouseover=function(){this.style.background='#dbd9f7';};
  btnN.onmouseout=function(){this.style.background='#ecebfb';};
  btnN.onclick=function(){document.getElementById('mtnOv').classList.remove('hidden');};
  var acts=document.querySelector('.topbar-actions');
  if(acts)acts.insertBefore(btnN,acts.firstChild);

  /* ── Nuevo Contacto modal ── */
  document.body.insertAdjacentHTML('beforeend',[
    '<style>',
    '#mtnOv{font-family:Inter,system-ui,sans-serif}',
    '#mtnOv .mtn-card{background:#fff;border-radius:14px;padding:28px;width:440px;box-shadow:0 8px 32px rgba(26,24,48,.12);border:1px solid #ececf3}',
    '#mtnOv .mtn-kicker{font-size:.7rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#5b5ee0;margin-bottom:4px}',
    '#mtnOv h3{font-size:1.1rem;font-weight:700;color:#1a1830;margin-bottom:18px}',
    '#mtnOv .mtn-grid{display:grid;gap:10px}',
    '#mtnOv .mtn-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
    '#mtnOv .mtn-field{display:flex;flex-direction:column;gap:4px}',
    '#mtnOv .mtn-field label{font-size:.71rem;font-weight:500;color:#76748a}',
    '#mtnOv input,#mtnOv select{padding:9px 10px;border:1px solid #ececf3;background:#f6f6fa;color:#1a1830;border-radius:8px;font-size:.84rem;font-family:inherit;outline:none}',
    '#mtnOv input:focus,#mtnOv select:focus{border-color:#5b5ee0;box-shadow:0 0 0 3px #ecebfb}',
    '#mtnOv .mtn-foot{display:flex;gap:8px;margin-top:18px}',
    '#mtnOv .mtn-save{flex:1;background:#1a1830;color:#fff;border:none;padding:11px;border-radius:8px;font-weight:700;font-size:.86rem;cursor:pointer;font-family:inherit}',
    '#mtnOv .mtn-save:hover{background:#5b5ee0}',
    '#mtnOv .mtn-cancel{flex:0 0 auto;background:transparent;color:#76748a;border:1px solid #ececf3;padding:11px 18px;border-radius:8px;font-size:.84rem;cursor:pointer;font-family:inherit}',
    '#mtnOv .mtn-cancel:hover{background:#f6f6fa}',
    '</style>',
    '<div id="mtnOv" class="resultado-overlay hidden" onclick="if(event.target===this)this.classList.add(\'hidden\')">',
    '<div class="mtn-card">',
    '<div class="mtn-kicker">CRM · MT90 Tracción</div>',
    '<h3>Nuevo contacto</h3>',
    '<div class="mtn-grid">',
    '<div class="mtn-field"><label>Nombre *</label><input id="mtnNom" placeholder="Cómo lo vas a buscar"></div>',
    '<div class="mtn-row">',
    '<div class="mtn-field"><label>Teléfono <span style="color:#8b89a4;font-weight:400">sin +54</span></label><input id="mtnTel" placeholder="11 5926 7961"></div>',
    '<div class="mtn-field"><label>Etapa</label><select id="mtnEtapa"><option value="">— opcional —</option><option value="Caliente">Caliente</option><option value="Media">Media</option><option value="Tibio">Tibio</option><option value="Fria">Fría</option></select></div>',
    '</div>',
    '<div class="mtn-field"><label>Antecedente</label><input id="mtnAnte" placeholder="Cómo lo conociste · referido, radar, open house…"></div>',
    '<div class="mtn-field"><label>Necesidad</label><input id="mtnNec" placeholder="Qué busca o qué tiene · venta, alquiler, ACM…"></div>',
    '<div class="mtn-field"><label>Fecha último contacto <span style="color:#8b89a4;font-weight:400">dd/mm/aaaa</span></label><input id="mtnFuc" placeholder="27 / 05 / 2026"></div>',
    '</div>',
    '<div class="mtn-foot">',
    '<button class="mtn-save" onclick="guardarNuevoContacto()">Guardar contacto</button>',
    '<button class="mtn-cancel" onclick="document.getElementById(\'mtnOv\').classList.add(\'hidden\')">Cancelar</button>',
    '</div></div></div>'
  ].join(''));

  window.guardarNuevoContacto=function(){
    var nom=document.getElementById('mtnNom').value.trim();
    if(!nom){alert('El nombre es obligatorio');return;}
    var tel=document.getElementById('mtnTel').value.trim();
    fetch('/contactos',{
      method:'POST',credentials:'same-origin',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        nombre:nom,cliente:nom,telefono:tel,
        whatsapp_link:tel?'https://wa.me/54'+tel.replace(/\D/g,''):'',
        antecedente:document.getElementById('mtnAnte').value.trim(),
        necesidad:document.getElementById('mtnNec').value.trim(),
        fecha_ultimo_contacto:document.getElementById('mtnFuc').value.trim(),
        etapa:document.getElementById('mtnEtapa').value||null,
      })
    }).then(function(r){
      if(!r.ok)throw new Error('Error al guardar');
      document.getElementById('mtnOv').classList.add('hidden');
      ['mtnNom','mtnTel','mtnAnte','mtnNec','mtnFuc'].forEach(function(id){document.getElementById(id).value='';});
      document.getElementById('mtnEtapa').value='';
      cargarDesdeSupabase();
    }).catch(function(err){alert('Error: '+err.message);});
  };

  /* ── Botón eliminar contacto en panel de detalle ── */
  (function(){
    var btn=document.createElement('button');
    btn.id='dEliminarBtn';
    btn.textContent='Eliminar contacto';
    btn.style.cssText='width:100%;margin-top:10px;padding:8px;background:transparent;border:1px solid #fecaca;color:#dc2626;border-radius:7px;font-family:Inter,sans-serif;font-size:.76rem;font-weight:600;cursor:pointer;transition:all .15s';
    btn.onmouseover=function(){this.style.background='#fef2f2';};
    btn.onmouseout=function(){this.style.background='transparent';};
    btn.onclick=function(){
      var c=DATA[selectedIdx];
      if(!c||!c.id)return;
      if(!confirm('¿Eliminar a '+c.nombre+'? Esta acción no se puede deshacer.'))return;
      fetch('/contactos/'+c.id,{method:'DELETE',credentials:'same-origin'})
        .then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json();})
        .then(function(){
          cerrarDetalle();
          cargarDesdeSupabase();
        })
        .catch(function(e){alert('Error al eliminar: '+e.message);});
    };
    var contBtn=document.getElementById('dContBtn');
    if(contBtn&&contBtn.parentNode)contBtn.parentNode.insertBefore(btn,contBtn.nextSibling);
  })();

  /* ════════════════════════════════════════════════════
     MODO REVISIÓN — recorre todos los contactos uno a uno
     ════════════════════════════════════════════════════ */
  (function(){
    var _tib=(window._AGENTE_KEY==='gabriela')?1:2;
    var STAGE_ORD={Caliente:0,Media:1,Tibio:_tib,Fria:3,'Sin Etapa':4,'':4};
    var rvList=[],rvIdx=0;

    function buildRevList(){
      var a=(typeof DATA!=='undefined'?DATA:[]).slice();
      a.sort(function(x,y){
        var d=(STAGE_ORD[x.etapa]||4)-(STAGE_ORD[y.etapa]||4);
        return d!==0?d:(y.dias_desde_contacto||0)-(x.dias_desde_contacto||0);
      });
      return a;
    }

    function getAgNom(){
      var g=document.getElementById('aurora-greet');
      if(g){var m=g.textContent.match(/[Bb]uenos\s+\S+[,\s]+(\S+)/);if(m&&m[1])return m[1];}
      return 'tu agente';
    }

    function waTpl(c){
      var nom=(c.nombre||'').split(' ')[0]||'Hola';
      var nec=c.necesidad||'el inmueble';
      var ag=getAgNom();
      var e=c.etapa||'';
      if(e==='Caliente')
        return'Hola '+nom+'! ¿Cómo va todo? Te escribo para ver cómo estamos con lo de '+nec+'. Cualquier novedad me avisás 🏠';
      if(e==='Media')
        return'Hola '+nom+'! ¿Cómo estás? Quería ver si seguís con planes de '+nec+'. Estoy disponible cuando lo necesites 👋';
      if(e==='Tibio')
        return'Hola '+nom+'! Soy '+ag+' de RE/MAX. Hablamos hace un tiempo sobre '+nec+'. Cuando quieras retomamos, sin apuro 😊';
      return'Hola '+nom+'! Soy '+ag+' de RE/MAX. Hace un tiempo hablamos sobre '+nec+'. ¿Sigue vigente el tema? 🙌';
    }

    function etColor(e){
      return{Caliente:'#ef4444',Media:'#f59e0b',Tibio:'#f97316',Fria:'#3b82f6'}[e]||'#6b7280';
    }

    /* ── Botón "Revisión" en topbar ── */
    var rvBtn=document.createElement('button');
    rvBtn.className='btn-topbar';
    rvBtn.innerHTML='&#128203; Revisión';
    rvBtn.style.cssText='background:#1a1830;border:1px solid #1a1830;color:#fff;font-weight:700;font-family:Inter,system-ui,sans-serif';
    rvBtn.onmouseover=function(){this.style.background='#5b5ee0';this.style.borderColor='#5b5ee0';};
    rvBtn.onmouseout=function(){this.style.background='#1a1830';this.style.borderColor='#1a1830';};
    rvBtn.onclick=function(){window.abrirRevision();};
    var acts=document.querySelector('.topbar-actions');
    if(acts)acts.appendChild(rvBtn);

    /* ── Modal HTML ── */
    document.body.insertAdjacentHTML('beforeend',[
      '<style>',
      '#rvOv{font-family:Inter,system-ui,sans-serif;position:fixed;inset:0;background:rgba(10,6,30,.74);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(3px)}',
      '#rvOv.hidden{display:none!important}',
      '#rvCard{background:#fff;border-radius:18px;width:min(940px,96vw);max-height:93vh;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 28px 72px rgba(10,6,30,.32);border:1px solid #ececf3}',
      '#rvHead{background:#0f0a28;padding:14px 22px;display:flex;align-items:center;gap:12px}',
      '#rvHead .rv-ttl{color:#fff;font-weight:700;font-size:.95rem;flex:1}',
      '#rvHead .rv-etapa-strip{font-size:.7rem;font-weight:700;padding:2px 10px;border-radius:10px;color:#fff;letter-spacing:.04em;text-transform:uppercase}',
      '#rvHead .rv-prog-txt{color:rgba(255,255,255,.45);font-size:.75rem;white-space:nowrap}',
      '#rvHead .rv-x{background:transparent;border:none;color:rgba(255,255,255,.45);font-size:1.1rem;cursor:pointer;padding:4px 8px;border-radius:6px;line-height:1}',
      '#rvHead .rv-x:hover{color:#fff;background:rgba(255,255,255,.1)}',
      '#rvBody{display:flex;flex:1;overflow:hidden;min-height:0}',
      '#rvLeft{width:220px;min-width:220px;padding:24px 18px 20px;display:flex;flex-direction:column;align-items:center;gap:11px;border-right:1px solid #ececf3;background:#f8f7fd;overflow-y:auto}',
      '#rvAv{border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:1.6rem;color:#fff;width:76px;height:76px;flex-shrink:0}',
      '#rvNom{font-weight:700;font-size:1rem;color:#1a1830;text-align:center;line-height:1.25}',
      '#rvEt{font-size:.68rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;padding:3px 12px;border-radius:12px;color:#fff}',
      '#rvDias{font-size:.77rem;color:#76748a;font-weight:500;text-align:center}',
      '#rvAlert{font-size:.72rem;font-weight:600;padding:3px 10px;border-radius:6px;background:#fef2f2;color:#dc2626;border:1px solid #fecaca;text-align:center;display:none}',
      '#rvWABtn{width:100%;padding:9px;background:#25d366;color:#fff;border:none;border-radius:9px;font-weight:700;font-size:.79rem;cursor:pointer;font-family:inherit}',
      '#rvWABtn:hover{background:#1db855}',
      '#rvRight{flex:1;padding:22px 26px;overflow-y:auto;display:flex;flex-direction:column;gap:16px}',
      '.rv-lbl{font-size:.67rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#76748a;margin-bottom:5px}',
      '.rv-lbl.accent{color:#5b5ee0}',
      '.rv-lbl.green{color:#16a34a}',
      '.rv-chips{display:flex;flex-wrap:wrap;gap:6px}',
      '.rv-chip{font-size:.75rem;padding:3px 11px;background:#f0f0f9;color:#3a3ad0;border-radius:6px;font-weight:500;border:1px solid #e0e0f5}',
      '#rvPA{width:100%;min-height:88px;padding:10px 13px;border:2px solid #5b5ee0;border-radius:10px;font-family:inherit;font-size:.87rem;color:#1a1830;resize:vertical;outline:none;background:#fff;box-sizing:border-box;transition:border-color .15s}',
      '#rvPA:focus{border-color:#3a3ad0;box-shadow:0 0 0 3px #ecebfb}',
      '#rvPA::placeholder{color:#a09fc0}',
      '#rvWAMsg{width:100%;min-height:76px;padding:10px 13px;border:1px solid #bbf7d0;border-radius:10px;font-family:inherit;font-size:.83rem;color:#1a1830;resize:vertical;outline:none;background:#f0fdf4;box-sizing:border-box}',
      '#rvWAMsg:focus{border-color:#25d366;box-shadow:0 0 0 3px #dcfce7;background:#fff}',
      '.rv-wa-btns{display:flex;gap:8px;margin-top:6px;flex-wrap:wrap}',
      '.rv-wa-btns button{padding:7px 14px;border-radius:8px;font-size:.77rem;font-weight:700;cursor:pointer;font-family:inherit;border:1px solid #bbf7d0;background:#f0fdf4;color:#16a34a;transition:background .15s}',
      '.rv-wa-btns button:hover{background:#dcfce7}',
      '#rvFoot{padding:13px 22px;border-top:1px solid #ececf3;display:flex;align-items:center;gap:10px;background:#fff}',
      '#rvPrev{background:#f6f6fa;color:#1a1830;border:1px solid #ececf3;padding:9px 18px;border-radius:9px;font-weight:600;font-size:.84rem;cursor:pointer;font-family:inherit}',
      '#rvPrev:hover:not(:disabled){background:#ececf3}',
      '#rvPrev:disabled{opacity:.35;cursor:default}',
      '#rvNext{background:#1a1830;color:#fff;border:none;padding:9px 22px;border-radius:9px;font-weight:700;font-size:.84rem;cursor:pointer;font-family:inherit;margin-left:auto}',
      '#rvNext:hover{background:#5b5ee0}',
      '#rvBar{flex:1;height:4px;background:#ececf3;border-radius:2px;overflow:hidden;max-width:300px}',
      '#rvFill{height:100%;background:#5b5ee0;border-radius:2px;transition:width .3s}',
      '</style>',
      '<div id="rvOv" class="hidden" onclick="if(event.target===this)window.cerrarRevision()">',
      '<div id="rvCard">',
      '<div id="rvHead">',
      '<div class="rv-ttl">&#128203; Modo Revisión</div>',
      '<span id="rvEtapaStrip" class="rv-etapa-strip"></span>',
      '<div class="rv-prog-txt" id="rvProgTxt"></div>',
      '<button class="rv-x" onclick="window.cerrarRevision()" title="Cerrar">&#x2715;</button>',
      '</div>',
      '<div id="rvBody">',
      '<div id="rvLeft">',
      '<div id="rvAv"></div>',
      '<div id="rvNom"></div>',
      '<span id="rvEt"></span>',
      '<div id="rvDias"></div>',
      '<div id="rvAlert"></div>',
      '<button id="rvWABtn" onclick="window.rvAbrirWADirecto()">&#128222; WhatsApp</button>',
      '</div>',
      '<div id="rvRight">',
      '<div><div class="rv-lbl">Contexto</div><div class="rv-chips" id="rvChips"></div></div>',
      '<div>',
      '<div class="rv-lbl accent">&#9733; Próxima acción <span style="font-size:.63rem;font-weight:400;text-transform:none;letter-spacing:0;color:#a09fc0">(se guarda al avanzar)</span></div>',
      '<textarea id="rvPA" placeholder="¿Cuál es el siguiente paso concreto con este contacto?"></textarea>',
      '</div>',
      '<div>',
      '<div class="rv-lbl green">&#128172; Mensaje WhatsApp</div>',
      '<textarea id="rvWAMsg" placeholder="Mensaje sugerido — editá antes de enviar…"></textarea>',
      '<div class="rv-wa-btns">',
      '<button onclick="window.rvCopiarWA()" id="rvCopyBtn">&#128203; Copiar</button>',
      '<button onclick="window.rvAbrirWAWeb()">&#9654; Abrir en WhatsApp Web</button>',
      '</div>',
      '</div>',
      '</div>',
      '</div>',
      '<div id="rvFoot">',
      '<button id="rvPrev" onclick="window.rvAnterior()" disabled>&#8592; Anterior</button>',
      '<div id="rvBar"><div id="rvFill" style="width:0%"></div></div>',
      '<button id="rvNext" onclick="window.rvSiguiente()">Guardar y siguiente &#8594;</button>',
      '</div>',
      '</div>',
      '</div>'
    ].join(''));

    function rvMostrar(idx){
      var c=rvList[idx];if(!c)return;
      // left panel
      var av=document.getElementById('rvAv');
      av.style.background=avBg(c.nombre);
      av.textContent=avIni(c.nombre);
      document.getElementById('rvNom').textContent=c.nombre||'—';
      var etEl=document.getElementById('rvEt');
      etEl.textContent=c.etapa||'Sin Etapa';
      etEl.style.background=etColor(c.etapa);
      var d=c.dias_desde_contacto||0;
      document.getElementById('rvDias').textContent=d===1?'1 día sin contacto':d+' días sin contacto';
      var al=document.getElementById('rvAlert');
      if(c.alerta){al.textContent=c.alerta;al.style.display='block';}else{al.style.display='none';}
      // strip in header
      var strip=document.getElementById('rvEtapaStrip');
      strip.textContent=c.etapa||'Sin Etapa';
      strip.style.background=etColor(c.etapa);
      // right panel
      var chips='';
      if(c.antecedente)chips+='<span class="rv-chip">'+c.antecedente+'</span>';
      if(c.necesidad)chips+='<span class="rv-chip">'+c.necesidad+'</span>';
      if(c.prioridad)chips+='<span class="rv-chip" style="background:#fff7ed;color:#c2410c;border-color:#fed7aa">'+c.prioridad+'</span>';
      document.getElementById('rvChips').innerHTML=chips||'<span class="rv-chip" style="background:#f8fafc;color:#94a3b8;border-color:#e2e8f0">Sin datos</span>';
      document.getElementById('rvPA').value=c.proxima_accion||'';
      document.getElementById('rvWAMsg').value=waTpl(c);
      // progress
      var tot=rvList.length;
      document.getElementById('rvProgTxt').textContent=(idx+1)+' / '+tot;
      document.getElementById('rvFill').style.width=Math.round((idx+1)/tot*100)+'%';
      // nav buttons
      var prev=document.getElementById('rvPrev');
      prev.disabled=(idx===0);
      prev.style.opacity=(idx===0)?'.35':'1';
      document.getElementById('rvNext').textContent=(idx===tot-1)?'Finalizar revisión ✓':'Guardar y siguiente →';
    }

    window.abrirRevision=function(){
      rvList=buildRevList();
      if(!rvList.length){alert('No hay contactos para revisar.');return;}
      rvIdx=0;
      rvMostrar(0);
      document.getElementById('rvOv').classList.remove('hidden');
    };

    window.cerrarRevision=function(){
      document.getElementById('rvOv').classList.add('hidden');
    };

    window.rvAnterior=function(){
      if(rvIdx>0){rvIdx--;rvMostrar(rvIdx);}
    };

    window.rvSiguiente=function(){
      var c=rvList[rvIdx];
      var pa=document.getElementById('rvPA').value.trim();
      var req;
      if(pa!==(c.proxima_accion||'').trim()){
        req=fetch('/contactos/'+c.id,{
          method:'PUT',credentials:'same-origin',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({proxima_accion:pa})
        }).then(function(){c.proxima_accion=pa;});
      }else{req=Promise.resolve();}
      req.then(function(){
        if(rvIdx<rvList.length-1){rvIdx++;rvMostrar(rvIdx);}
        else{window.cerrarRevision();cargarDesdeSupabase();}
      }).catch(function(e){alert('Error al guardar: '+e.message);});
    };

    window.rvAbrirWADirecto=function(){
      var c=rvList[rvIdx];
      if(c&&c.whatsapp_url)window.open(c.whatsapp_url,'_blank');
    };

    window.rvCopiarWA=function(){
      var msg=document.getElementById('rvWAMsg').value;
      var btn=document.getElementById('rvCopyBtn');
      (navigator.clipboard?navigator.clipboard.writeText(msg):Promise.resolve()).then(function(){
        btn.textContent='✓ Copiado!';
        setTimeout(function(){btn.innerHTML='&#128203; Copiar';},2200);
      });
    };

    window.rvAbrirWAWeb=function(){
      var c=rvList[rvIdx];if(!c)return;
      var msg=encodeURIComponent(document.getElementById('rvWAMsg').value);
      var phone='';
      if(c.whatsapp_url){var m=c.whatsapp_url.match(/wa\.me\/(\d+)/);if(m)phone=m[1];}
      window.open('https://wa.me/'+(phone?phone:'')+'?text='+msg,'_blank');
    };

  })();
  /* ════════════════════════════════════════════════════ */

  window.sincronizar=cargarDesdeSupabase;
  window.cargarTodo=cargarDesdeSupabase;
  cargarDesdeSupabase();
})();
</script>
"""

@app.route("/crm")
@login_required
def crm():
    agente_key = session.get("agente_key", "gabriela")
    _here = os.path.dirname(__file__)
    for candidate in [
        os.path.join(_here, f"{agente_key}.html"),
        os.path.join(_here, "crm", f"{agente_key}.html"),
    ]:
        if os.path.exists(candidate):
            with open(candidate, encoding="utf-8") as f:
                content = f.read()
            agente_js = f'<script>window._AGENTE_KEY="{agente_key}";</script>'
            return content + agente_js + _SUPA_INJECT, 200, {"Content-Type": "text/html; charset=utf-8"}
    return redirect(url_for("index"))


@app.route("/")
@login_required
def index():
    sid = get_sid()
    if sid not in _agentes:
        _agentes[sid] = session.get("agente_key", "gabriela")
    return render_template("index.html", agentes=cfg.AGENTES, agente_activo=_agentes[sid])


@app.route("/set_agente", methods=["POST"])
@login_required
def set_agente():
    sid = get_sid()
    data = request.get_json()
    _agentes[sid]     = data.get("agente", "gabriela")
    _historiales[sid] = []
    return {"ok": True}


@app.route("/limpiar", methods=["POST"])
@login_required
def limpiar():
    sid = get_sid()
    _historiales[sid] = []
    return {"ok": True}


@app.route("/chat", methods=["POST"])
@login_required
def chat():
    sid       = get_sid()
    data      = request.get_json()
    mensaje   = data.get("mensaje", "").strip()
    con_radar = data.get("con_radar", False)

    if not mensaje:
        return {"error": "Mensaje vacío"}, 400

    agente_key  = _agentes.get(sid, "gabriela")
    agente_info = cfg.AGENTES.get(agente_key, cfg.AGENTES["gabriela"])
    history     = _historiales.get(sid, [])

    system = cfg.SYSTEM_PROMPT
    system += f"\n\nAgente activo: {agente_info['nombre']} — {agente_info.get('oficina','')}"
    system += f"\nEmail: {agente_info['email']}"
    system += f"\nBarrios que trabaja: {', '.join(agente_info['barrios'])}"

    if con_radar:
        radar_ctx = cargar_radar_hoy(agente_key)
        system += radar_ctx if radar_ctx else \
            "\n\n[No se encontró radar del día. Podés pegar los datos directamente en el chat.]"

    history.append({"role": "user", "content": mensaje})

    def generar():
        respuesta_completa = ""
        try:
            with client.messages.stream(
                model=cfg.MODELO,
                max_tokens=2048,
                system=system,
                messages=history,
            ) as stream:
                for texto in stream.text_stream:
                    respuesta_completa += texto
                    yield f"data: {json.dumps({'texto': texto})}\n\n"

        except anthropic.AuthenticationError:
            yield f"data: {json.dumps({'error': 'API key inválida. Configurá ANTHROPIC_API_KEY en config_ia.py'})}\n\n"
            return
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
            return

        history.append({"role": "assistant", "content": respuesta_completa})
        if len(history) > 40:
            history[:] = history[-40:]
        _historiales[sid] = history
        yield f"data: {json.dumps({'fin': True})}\n\n"

    return Response(generar(), mimetype="text/event-stream",
                    headers={"X-Accel-Buffering": "no", "Cache-Control": "no-cache"})


ACM_PROMPT = """Generá un ACM (Análisis Comparativo de Mercado) profesional en español para presentar a un propietario en una reunión de captación.

IMPORTANTE: La fecha de hoy es {fecha_hoy}. Usá EXACTAMENTE esta fecha en el informe como fecha del relevamiento.

CONTEXTO CRÍTICO — leé esto antes de analizar:
Los datos provienen de múltiples portales: Zonaprop, MercadoLibre y Argenprop. TODOS son PRECIOS DE PUBLICACIÓN (lo que el vendedor pide), NO precios de cierre. En el mercado actual de CABA:
- La brecha entre precio pedido y precio de cierre es del 10 al 18%.
- Zonaprop tiende a tener los precios de publicación más altos.
- MercadoLibre y Argenprop suelen reflejar mejor el precio al que realmente se negocia.
- El precio promedio de los tres portales combinados es el indicador más representativo del mercado real.
- Si el promedio entre portales difiere más del 10%, mencionalo como señal de mercado disperso.

REGLA FUNDAMENTAL: El precio que recomendés para publicar NO puede estar por encima del promedio de publicación del mercado. Si lo pusieran más alto, la propiedad no recibiría visitas y quedaría estancada.

Los datos de comparables activos son los siguientes:

{datos}

El ACM debe tener esta estructura:
1. **Relevamiento al {fecha_hoy}** — indicá esta fecha exacta al inicio
2. **Resumen del Mercado** — mostrá el precio promedio por portal (Zonaprop, MercadoLibre, Argenprop), el promedio unificado, y el rango de precio/m². Indicá cuántos comparables activos hay en total. Aclarás que son precios pedidos, no de cierre.
3. **Comparables Destacados** — 5 a 8 propiedades similares de distintos portales, con precio, superficie, portal de origen y link
4. **Precio Recomendado** — dos valores claros y diferenciados:
   - *Precio de publicación sugerido*: calculado sobre el promedio multi-portal, NO sobre el máximo de Zonaprop. Debe ser competitivo para generar consultas.
   - *Precio de cierre estimado*: el rango realista de lo que el propietario va a cobrar (restá 10-15% al precio de publicación)
   Justificá con números concretos del mercado relevado.
5. **Argumento para el Propietario** — 3-4 líneas sobre por qué publicar al precio correcto desde el inicio genera más consultas, más competencia entre compradores y mejor precio final

Tono: profesional, basado en datos, sin prometer valores que el mercado no convalida. Usá números concretos. Formato listo para mostrar en reunión.
Si faltan datos de m² en algunos comparables, hacé el análisis con los disponibles y mencionalo brevemente.
"""

@app.route("/acm", methods=["POST"])
@login_required
def acm():
    sid  = get_sid()
    data = request.get_json()

    barrio     = (data.get("barrio")    or "").strip()
    tipo       = (data.get("tipo")      or "departamento").strip()
    m2         = data.get("m2")
    ambientes  = data.get("ambientes")
    direccion  = (data.get("direccion") or "").strip() or None

    if not barrio:
        return {"error": "Barrio requerido"}, 400

    try:
        m2_int  = int(m2)        if m2        else None
        amb_int = int(ambientes) if ambientes  else None
    except (ValueError, TypeError):
        m2_int = amb_int = None

    agente_key  = _agentes.get(sid, "gabriela")
    agente_info = cfg.AGENTES.get(agente_key, cfg.AGENTES["gabriela"])

    def generar():
        import queue as _queue, threading as _threading
        if direccion:
            msg_busq = f'🔍 Consultando Zonaprop, MercadoLibre y Argenprop cerca de **{direccion}** ({barrio.title()})...\n'
        else:
            msg_busq = f'🔍 Consultando Zonaprop, MercadoLibre y Argenprop en **{barrio.title()}** ({tipo})...\n'
        yield f"data: {json.dumps({'texto': msg_busq})}\n\n"

        # Correr scraping en un thread y hacer streaming de progreso vía queue
        prog_q      = _queue.Queue()
        result_box  = {}

        def _scrape():
            try:
                result_box['data'] = acm_scraper.buscar_comparables(
                    barrio, tipo, m2_int, amb_int, paginas=1,
                    direccion=direccion, radio_km=1.0,
                    progress_cb=lambda msg: prog_q.put(msg)
                )
            except Exception as e:
                result_box['error'] = str(e)
            finally:
                prog_q.put(None)  # sentinel

        _threading.Thread(target=_scrape, daemon=True).start()

        # Hacer yield de cada mensaje de progreso mientras scrapea
        while True:
            try:
                msg = prog_q.get(timeout=40)
            except _queue.Empty:
                yield f"data: {json.dumps({'texto': '\\n⚠️ Timeout buscando comparables.'})}\n\n"
                yield f"data: {json.dumps({'fin': True})}\n\n"
                return
            if msg is None:
                break
            yield f"data: {json.dumps({'texto': '  ' + msg + '\\n'})}\n\n"

        if 'error' in result_box:
            yield f"data: {json.dumps({'error': f'Error al buscar comparables: {result_box[\"error\"]}'})}\n\n"
            return

        comparables = result_box.get('data', [])
        if not comparables:
            yield f"data: {json.dumps({'texto': '\\n⚠️ No se encontraron comparables. Verificá el nombre del barrio (ej: \"palermo\", \"villa-urquiza\").'})}\n\n"
            yield f"data: {json.dumps({'fin': True})}\n\n"
            return

        yield f"data: {json.dumps({'texto': f'\\n📊 {len(comparables)} comparables encontrados. Generando ACM...\\n\\n'})}\n\n"

        from datetime import datetime
        datos_texto = acm_scraper.formatear_para_claude(
            barrio, tipo, m2_int, amb_int, comparables,
            direccion=direccion, radio_km=1.0 if direccion else None
        )
        prompt_acm  = ACM_PROMPT.format(datos=datos_texto, fecha_hoy=datetime.now().strftime("%d/%m/%Y"))

        history = _historiales.get(sid, [])
        dir_txt = f", Dirección: {direccion}" if direccion else ""
        history.append({"role": "user", "content": f"[ACM solicitado] Barrio: {barrio.title()}, Tipo: {tipo}, m²: {m2_int or 'n/d'}, Ambientes: {amb_int or 'n/d'}{dir_txt}"})

        respuesta_completa = ""
        try:
            system = cfg.SYSTEM_PROMPT
            system += f"\n\nAgente activo: {agente_info['nombre']} — {agente_info.get('oficina','')}"
            system += f"\nEmail: {agente_info['email']}"

            with client.messages.stream(
                model=cfg.MODELO,
                max_tokens=3000,
                system=system,
                messages=[{"role": "user", "content": prompt_acm}],
            ) as stream:
                for texto in stream.text_stream:
                    respuesta_completa += texto
                    yield f"data: {json.dumps({'texto': texto})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
            return

        history.append({"role": "assistant", "content": f"[ACM {barrio.title()} {tipo}]\n{respuesta_completa}"})
        if len(history) > 40:
            history[:] = history[-40:]
        _historiales[sid] = history
        _ultimo_acm[sid] = {
            "barrio":         barrio.title(),
            "tipo":           tipo.title(),
            "m2":             m2_int,
            "ambientes":      amb_int,
            "contenido":      respuesta_completa,
            "agente_nombre":  agente_info["nombre"],
            "agente_email":   agente_info["email"],
            "oficina":        agente_info.get("oficina", ""),
        }
        yield f"data: {json.dumps({'fin': True, 'mostrar_acciones': True})}\n\n"

    return Response(generar(), mimetype="text/event-stream",
                    headers={"X-Accel-Buffering": "no", "Cache-Control": "no-cache"})


@app.route("/acm_wapp")
@login_required
def acm_wapp():
    """Devuelve texto formateado para WhatsApp del último ACM."""
    sid = get_sid()
    acm = _ultimo_acm.get(sid)
    if not acm:
        return {"error": "No hay ACM generado"}, 404

    # Extraer datos clave del contenido con regex
    contenido = acm["contenido"]
    precio_rec = ""
    m = re.search(r'[Pp]recio\s+[Rr]ecomendado[^\n:]*[:]\s*([^\n]{5,60})', contenido)
    if m:
        precio_rec = m.group(1).strip().rstrip(".,")

    subtitulo = " · ".join(filter(None, [
        acm["tipo"],
        f"{acm['m2']} m²" if acm["m2"] else None,
        f"{acm['ambientes']} amb" if acm["ambientes"] else None,
    ]))

    lineas = [
        f"*ACM · {acm['barrio']}* 🏠",
        f"_{subtitulo}_",
        "",
        "📊 *Análisis Comparativo de Mercado*",
        "",
    ]

    # Incluir las primeras secciones del contenido (texto plano limpio)
    texto_plano = re.sub(r'\*\*(.+?)\*\*', r'*\1*', contenido)   # bold
    texto_plano = re.sub(r'#+\s*(.+)', r'*\1*', texto_plano)      # headings → bold
    # Solo primeros 1200 caracteres para que no sea gigante en wapp
    if len(texto_plano) > 1200:
        texto_plano = texto_plano[:1200] + "..."
    lineas.append(texto_plano)
    lineas += [
        "",
        f"_Preparado por {acm['agente_nombre']} · {acm['oficina']}_",
        "_MT90 Tracción_",
    ]

    return {"texto": "\n".join(lineas)}


@app.route("/radar_resumen", methods=["POST"])
@login_required
def radar_resumen():
    """Carga el radar del día y pide a Claude un resumen accionable."""
    sid         = get_sid()
    agente_key  = _agentes.get(sid, "gabriela")
    agente_info = cfg.AGENTES.get(agente_key, cfg.AGENTES["gabriela"])

    radar_ctx = cargar_radar_hoy(agente_key)

    if not radar_ctx:
        def sin_radar():
            yield f"data: {json.dumps({'texto': '⚠️ No encontré el radar de Facebook de hoy. Corré primero correr_facebook_gabriela.bat (o la de tu agente).'})}\n\n"
            yield f"data: {json.dumps({'fin': True})}\n\n"
        return Response(sin_radar(), mimetype="text/event-stream",
                        headers={"X-Accel-Buffering": "no", "Cache-Control": "no-cache"})

    system  = cfg.SYSTEM_PROMPT
    system += f"\n\nAgente activo: {agente_info['nombre']} — {agente_info.get('oficina','')}"
    system += f"\nBarrios que trabaja: {', '.join(agente_info['barrios'])}"
    system += radar_ctx

    history = _historiales.get(sid, [])
    msg_user = "Resumí el radar de hoy: ¿cuántas oportunidades hay, cuáles son las más urgentes y por dónde arrancarías?"
    history.append({"role": "user", "content": msg_user})

    def generar():
        respuesta_completa = ""
        try:
            with client.messages.stream(
                model=cfg.MODELO,
                max_tokens=1500,
                system=system,
                messages=history,
            ) as stream:
                for texto in stream.text_stream:
                    respuesta_completa += texto
                    yield f"data: {json.dumps({'texto': texto})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
            return

        history.append({"role": "assistant", "content": respuesta_completa})
        if len(history) > 40:
            history[:] = history[-40:]
        _historiales[sid] = history
        yield f"data: {json.dumps({'fin': True})}\n\n"

    return Response(generar(), mimetype="text/event-stream",
                    headers={"X-Accel-Buffering": "no", "Cache-Control": "no-cache"})


def _md_a_html(texto: str) -> str:
    """Convierte markdown básico a HTML para el reporte imprimible."""
    lineas = texto.split("\n")
    html = ""
    for l in lineas:
        l_esc = l.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")
        if l_esc.startswith("### "):
            html += f'<h3>{l_esc[4:]}</h3>\n'
        elif l_esc.startswith("## "):
            html += f'<h2>{l_esc[3:]}</h2>\n'
        elif l_esc.startswith("# "):
            html += f'<h1>{l_esc[2:]}</h1>\n'
        elif l_esc.startswith("- ") or l_esc.startswith("* "):
            html += f'<li>{l_esc[2:]}</li>\n'
        elif not l_esc.strip():
            html += '<br>\n'
        else:
            # negrita
            l_esc = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', l_esc)
            html += f'<p>{l_esc}</p>\n'
    return html


@app.route("/exportar_acm")
@login_required
def exportar_acm():
    sid  = get_sid()
    acm  = _ultimo_acm.get(sid)
    if not acm:
        return "No hay ACM generado aún.", 404

    from datetime import datetime
    fecha    = datetime.now().strftime("%d/%m/%Y")
    subtitulo = " · ".join(filter(None, [
        acm["tipo"],
        f"{acm['m2']} m²" if acm["m2"] else None,
        f"{acm['ambientes']} ambientes" if acm["ambientes"] else None,
    ]))
    contenido_html = _md_a_html(acm["contenido"])

    html = f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>ACM · {acm['barrio']} · MT90 Tracción</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      font-family: 'Inter', 'Segoe UI', sans-serif;
      background: #f8fafc;
      color: #0f172a;
      padding: 40px 0;
    }}
    .page {{
      max-width: 720px;
      margin: 0 auto;
      background: white;
      border-radius: 16px;
      box-shadow: 0 4px 24px rgba(0,0,0,.08);
      overflow: hidden;
    }}
    .header {{
      background: #0D1B2A;
      padding: 28px 36px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }}
    .logo {{ color: white; font-size: 1.2rem; font-weight: 900; letter-spacing: -.3px; }}
    .logo span {{ color: #1877f2; }}
    .header-meta {{ text-align: right; }}
    .header-meta .titulo {{ color: white; font-size: 1rem; font-weight: 700; }}
    .header-meta .sub {{ color: rgba(255,255,255,.5); font-size: .8rem; margin-top: 3px; }}
    .badge-barrio {{
      display: inline-block;
      background: #1877f2;
      color: white;
      font-size: .75rem;
      font-weight: 700;
      padding: 4px 12px;
      border-radius: 20px;
      margin-top: 8px;
    }}
    .body {{ padding: 32px 36px; }}
    .agente-box {{
      background: #f1f5f9;
      border-radius: 10px;
      padding: 12px 18px;
      margin-bottom: 24px;
      font-size: .83rem;
      color: #475569;
      display: flex;
      justify-content: space-between;
    }}
    .agente-box strong {{ color: #0f172a; }}
    h1, h2, h3 {{
      color: #0D1B2A;
      margin: 20px 0 8px;
    }}
    h1 {{ font-size: 1.2rem; border-bottom: 2px solid #1877f2; padding-bottom: 6px; }}
    h2 {{ font-size: 1.05rem; color: #1877f2; }}
    h3 {{ font-size: .95rem; }}
    p  {{ font-size: .88rem; color: #334155; line-height: 1.7; margin-bottom: 6px; }}
    li {{ font-size: .88rem; color: #334155; line-height: 1.7; margin-left: 20px; margin-bottom: 4px; }}
    strong {{ color: #0f172a; }}
    .footer {{
      border-top: 1px solid #e2e8f0;
      padding: 16px 36px;
      font-size: .72rem;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
    }}
    .no-print {{ margin: 24px auto; max-width: 720px; display: flex; gap: 12px; justify-content: center; }}
    .btn-print {{
      background: #0D1B2A; color: white;
      border: none; border-radius: 8px;
      padding: 11px 24px; font-size: .88rem; font-weight: 600;
      cursor: pointer;
    }}
    .btn-close {{
      background: #f1f5f9; color: #475569;
      border: 1px solid #e2e8f0; border-radius: 8px;
      padding: 11px 24px; font-size: .88rem; font-weight: 600;
      cursor: pointer; text-decoration: none;
    }}
    @media print {{
      body {{ background: white; padding: 0; }}
      .page {{ box-shadow: none; border-radius: 0; }}
      .no-print {{ display: none !important; }}
    }}
  </style>
</head>
<body>
  <div class="no-print">
    <button class="btn-print" onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>
    <a class="btn-close" href="javascript:window.close()">✕ Cerrar</a>
  </div>

  <div class="page">
    <div class="header">
      <div>
        <div class="logo">MT90 <span>Tracción</span></div>
        <div class="badge-barrio">{acm['barrio']}</div>
      </div>
      <div class="header-meta">
        <div class="titulo">Análisis Comparativo de Mercado</div>
        <div class="sub">{subtitulo}</div>
        <div class="sub">{fecha}</div>
      </div>
    </div>

    <div class="body">
      <div class="agente-box">
        <span>Preparado por <strong>{acm['agente_nombre']}</strong> · {acm['oficina']}</span>
        <span>{acm['agente_email']}</span>
      </div>
      {contenido_html}
    </div>

    <div class="footer">
      <span>MT90 Tracción · Análisis Comparativo de Mercado</span>
      <span>{fecha}</span>
    </div>
  </div>
</body>
</html>"""
    return html


@app.route("/enviar_acm", methods=["POST"])
@login_required
def enviar_acm():
    import smtplib
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText
    from datetime import datetime

    sid  = get_sid()
    acm  = _ultimo_acm.get(sid)
    if not acm:
        return {"error": "No hay ACM generado"}, 400

    data        = request.get_json()
    email_dest  = (data.get("email") or "").strip()
    if not email_dest:
        return {"error": "Email requerido"}, 400

    # Credenciales Gmail desde env vars o config local
    gmail_user = os.environ.get("GMAIL_USER", "").strip()
    gmail_pass = os.environ.get("GMAIL_PASS", "").strip()
    if not gmail_user or not gmail_pass:
        try:
            import importlib, sys
            sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "radar_captacion"))
            radar_cfg = importlib.import_module("config")
            gmail_user = radar_cfg.GMAIL_USUARIO
            gmail_pass = radar_cfg.GMAIL_PASSWORD
        except Exception:
            pass
    if not gmail_user or not gmail_pass:
        return {"error": "Email no configurado. Contactá al administrador."}, 500

    fecha    = datetime.now().strftime("%d/%m/%Y")
    subtitulo = " · ".join(filter(None, [
        acm["tipo"],
        f"{acm['m2']} m²" if acm["m2"] else None,
        f"{acm['ambientes']} amb" if acm["ambientes"] else None,
    ]))

    # Construir el HTML del email
    contenido_html = _md_a_html(acm["contenido"])
    html_email = f"""
    <div style="font-family:'Segoe UI',sans-serif;max-width:640px;margin:0 auto">
      <div style="background:#0D1B2A;padding:24px 28px;border-radius:12px 12px 0 0">
        <div style="color:white;font-size:1.1rem;font-weight:800">
          MT90 <span style="color:#1877f2">Tracción</span>
        </div>
        <div style="color:white;font-size:1rem;font-weight:700;margin-top:6px">
          Análisis Comparativo de Mercado
        </div>
        <div style="color:rgba(255,255,255,.55);font-size:.82rem;margin-top:4px">
          {acm['barrio']} · {subtitulo} · {fecha}
        </div>
      </div>
      <div style="background:white;padding:28px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;
                  font-size:.88rem;color:#334155;line-height:1.7">
        {contenido_html}
        <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;
                    font-size:.75rem;color:#94a3b8;text-align:center">
          MT90 Tracción · Preparado por {acm['agente_nombre']}
        </div>
      </div>
    </div>"""

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"ACM · {acm['barrio']} · {subtitulo} · {fecha}"
        msg["From"]    = gmail_user
        msg["To"]      = email_dest
        msg.attach(MIMEText(html_email, "html", "utf-8"))
        with smtplib.SMTP("smtp.gmail.com", 587) as s:
            s.starttls()
            s.login(gmail_user, gmail_pass)
            s.sendmail(gmail_user, [email_dest], msg.as_string())
        return {"ok": True}
    except Exception as e:
        return {"error": str(e)}, 500


@app.route("/contactos", methods=["GET"])
@login_required
def get_contactos():
    agente_key = session.get("agente_key", "")
    r = _req.get(
        f"{SUPABASE_URL}/rest/v1/contactos",
        headers=_supa_hdrs(),
        params={"agente": f"eq.{agente_key}", "select": "*", "order": "nombre.asc"},
        timeout=10,
    )
    if not r.ok:
        return {"error": r.text}, 500
    return r.json()


@app.route("/contactos", methods=["POST"])
@login_required
def crear_contacto():
    agente_key = session.get("agente_key", "")
    data = request.get_json()
    if not data:
        return {"error": "No data"}, 400
    data["agente"] = agente_key
    hdrs = {**_supa_hdrs(), "Prefer": "return=minimal"}
    try:
        r = _req.post(
            f"{SUPABASE_URL}/rest/v1/contactos",
            headers=hdrs,
            json=data,
            timeout=10,
        )
        if not r.ok:
            print(f"[SUPA POST error] {r.status_code} {r.text}")
            return {"error": r.text}, 500
        return {"ok": True}
    except Exception as e:
        print(f"[POST /contactos] {e}")
        return {"error": str(e)}, 500


@app.route("/contactos/<int:cid>", methods=["PUT"])
@login_required
def actualizar_contacto(cid):
    agente_key = session.get("agente_key", "")
    data = request.get_json()
    data.pop("id", None)
    data.pop("agente", None)
    r = _req.patch(
        f"{SUPABASE_URL}/rest/v1/contactos",
        headers=_supa_hdrs(),
        params={"id": f"eq.{cid}", "agente": f"eq.{agente_key}"},
        json=data,
        timeout=10,
    )
    if not r.ok:
        return {"error": r.text}, 500
    return {"ok": True}


@app.route("/contactos/<int:cid>", methods=["DELETE"])
@login_required
def eliminar_contacto(cid):
    agente_key = session.get("agente_key", "")
    hdrs = {**_supa_hdrs(), "Prefer": ""}
    r = _req.delete(
        f"{SUPABASE_URL}/rest/v1/contactos",
        headers=hdrs,
        params={"id": f"eq.{cid}", "agente": f"eq.{agente_key}"},
        timeout=10,
    )
    if not r.ok:
        return {"error": r.text}, 500
    return {"ok": True}


if __name__ == "__main__":
    print("=" * 55)
    print("  MT90 Tracción — Agente IA")
    print("  Abrí http://localhost:5050 en el navegador")
    print("=" * 55)
    app.run(host="0.0.0.0", port=5050, debug=False, threaded=True)
