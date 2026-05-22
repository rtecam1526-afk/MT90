#!/usr/bin/env python3
"""
MT90 Tracción — Agente IA
Asistente de captación para agentes Remax
"""

import os, json, glob, uuid, re, time
from functools import wraps
from flask import Flask, request, Response, render_template, session, redirect, url_for
import anthropic
import config_ia as cfg
import acm_scraper

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "mt90_traccion_secret_2024")

client = anthropic.Anthropic(api_key=cfg.ANTHROPIC_API_KEY, max_retries=3)

# Historial en memoria (app local, un solo usuario)
_historiales = {}   # session_id -> list of messages
_agentes     = {}   # session_id -> agente_key
_ultimo_acm  = {}   # session_id -> {barrio, tipo, m2, ambientes, contenido, agente_nombre}


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


def cargar_radar_hoy() -> str:
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


@app.route("/crm")
@login_required
def crm():
    agente_key = session.get("agente_key", "gabriela")
    crm_path = os.path.join(os.path.dirname(__file__), f"{agente_key}.html")
    if os.path.exists(crm_path):
        with open(crm_path, encoding="utf-8") as f:
            return f.read(), 200, {"Content-Type": "text/html; charset=utf-8"}
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
        radar_ctx = cargar_radar_hoy()
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

IMPORTANTE: La fecha de hoy es {fecha_hoy}. Usá EXACTAMENTE esta fecha en el informe como fecha del relevamiento. No uses ninguna otra fecha.

Los datos de comparables activos en Zonaprop son los siguientes:

{datos}

El ACM debe tener esta estructura:
1. **Relevamiento al {fecha_hoy}** — indicá esta fecha exacta al inicio
2. **Resumen del Mercado** — precio promedio, rango, precio por m², cantidad de competidores activos
3. **Comparables Destacados** — 4 a 6 propiedades similares con precio, superficie y link
4. **Precio Recomendado de Publicación** — rango sugerido con justificación breve
5. **Argumento para el Propietario** — 3-4 líneas concretas de por qué trabajar con un agente profesional maximiza el precio final y reduce el tiempo de venta

Tono: profesional, basado en datos, convincente. Usá números concretos. Formato listo para mostrar en pantalla o imprimir.
Si faltan datos de m² o ambientes en algunos comparables, hacé el análisis con los disponibles y mencionalo brevemente.
"""

@app.route("/acm", methods=["POST"])
@login_required
def acm():
    sid  = get_sid()
    data = request.get_json()

    barrio     = (data.get("barrio") or "").strip()
    tipo       = (data.get("tipo")   or "departamento").strip()
    m2         = data.get("m2")
    ambientes  = data.get("ambientes")

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
        yield f"data: {json.dumps({'texto': f'🔍 Buscando comparables en **{barrio.title()}** ({tipo})...'})}\n\n"

        try:
            comparables = acm_scraper.buscar_comparables(
                barrio, tipo, m2_int, amb_int, paginas=2
            )
        except Exception as e:
            yield f"data: {json.dumps({'error': f'Error al buscar comparables: {e}'})}\n\n"
            return

        if not comparables:
            yield f"data: {json.dumps({'texto': '\\n\\n⚠️ No se encontraron comparables en Zonaprop para ese barrio/tipo. Verificá el nombre del barrio (ej: \"palermo\", \"villa-urquiza\").'})}\n\n"
            yield f"data: {json.dumps({'fin': True})}\n\n"
            return

        yield f"data: {json.dumps({'texto': f'\\n\\n📊 {len(comparables)} comparables encontrados. Generando ACM...\\n\\n'})}\n\n"

        from datetime import datetime
        datos_texto = acm_scraper.formatear_para_claude(barrio, tipo, m2_int, amb_int, comparables)
        prompt_acm  = ACM_PROMPT.format(datos=datos_texto, fecha_hoy=datetime.now().strftime("%d/%m/%Y"))

        history = _historiales.get(sid, [])
        history.append({"role": "user", "content": f"[ACM solicitado] Barrio: {barrio.title()}, Tipo: {tipo}, m²: {m2_int or 'n/d'}, Ambientes: {amb_int or 'n/d'}"})

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

    radar_ctx = cargar_radar_hoy()

    if not radar_ctx:
        def sin_radar():
            yield f"data: {json.dumps({'texto': '⚠️ No encontré ningún archivo de radar generado hoy. Corré primero el radar desde la carpeta radar_captacion.'})}\n\n"
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

    # Reutilizar las credenciales Gmail del config del radar
    import importlib, sys
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "radar_captacion"))
    try:
        radar_cfg = importlib.import_module("config")
        gmail_user = radar_cfg.GMAIL_USUARIO
        gmail_pass = radar_cfg.GMAIL_PASSWORD
    except Exception:
        return {"error": "No se pudo cargar config de email"}, 500

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


if __name__ == "__main__":
    print("=" * 55)
    print("  MT90 Tracción — Agente IA")
    print("  Abrí http://localhost:5050 en el navegador")
    print("=" * 55)
    app.run(host="0.0.0.0", port=5050, debug=False, threaded=True)
