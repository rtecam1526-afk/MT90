"""
MT90 Tracción — ACM Scraper
Obtiene comparables de Zonaprop para generar el ACM
"""

import cloudscraper, json, re, time
from typing import Optional

BASE = "https://www.zonaprop.com.ar"

TIPO_URL = {
    "departamento": "departamentos",
    "casa":         "casas",
    "ph":           "ph",
    "local":        "locales-comerciales",
    "oficina":      "oficinas",
}

def _crear_session():
    s = cloudscraper.create_scraper(
        browser={"browser": "chrome", "platform": "windows", "mobile": False}
    )
    s.headers.update({"Accept-Language": "es-AR,es;q=0.9"})
    return s

def _fetch(session, url):
    for i in range(3):
        try:
            r = session.get(url, timeout=20)
            if r.status_code == 200:
                return r.text
            time.sleep(3 * (i + 1))
        except Exception:
            time.sleep(4)
    return None

def _extraer_state(html):
    m = re.search(r'window\.__PRELOADED_STATE__\s*=\s*(\{)', html)
    if not m:
        return None
    start = m.start(1)
    depth, i = 0, start
    while i < len(html):
        c = html[i]
        if c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(html[start:i+1])
                except Exception:
                    return None
        i += 1
    return None

def _extraer_m2_ambientes(p):
    m2 = None
    ambientes = None

    for attr in (p.get("attributes") or []):
        attr_id = (attr.get("id") or "").upper()
        values  = attr.get("values") or []
        val     = values[0].get("name") if values else None
        if val:
            if any(x in attr_id for x in ["SURFACE", "TOTAL_SURFACE", "COVERED_SURFACE", "SUPERFICIE"]):
                mo = re.search(r'(\d+)', str(val))
                if mo:
                    m2 = int(mo.group(1))
            elif any(x in attr_id for x in ["ROOM", "AMBIENT", "ENVIRONMENT"]):
                mo = re.search(r'(\d+)', str(val))
                if mo:
                    ambientes = int(mo.group(1))

    titulo = p.get("generatedTitle") or p.get("title") or ""
    if not m2:
        mo = re.search(r'(\d+)\s*m[²2]', titulo, re.IGNORECASE)
        if mo:
            m2 = int(mo.group(1))
    if not ambientes:
        mo = re.search(r'(\d+)\s*amb', titulo, re.IGNORECASE)
        if mo:
            ambientes = int(mo.group(1))

    return m2, ambientes

def buscar_comparables(barrio: str, tipo: str, m2_target: Optional[int] = None,
                       ambientes_target: Optional[int] = None, paginas: int = 2) -> list:
    """
    Busca comparables en Zonaprop para el barrio+tipo dados.
    Filtra por m² y ambientes si se especifican.
    Retorna lista de dicts con: titulo, precio, precio_usd, m2, ambientes, tipo_pub, url
    """
    barrio_url = barrio.strip().lower().replace(" ", "-")
    tipo_url   = TIPO_URL.get(tipo.lower(), tipo.lower() + "s")
    session    = _crear_session()
    todos      = []

    for pag in range(1, paginas + 1):
        if pag == 1:
            url = f"{BASE}/{tipo_url}-venta-{barrio_url}.html"
        else:
            url = f"{BASE}/{tipo_url}-venta-{barrio_url}-pagina-{pag}.html"

        html = _fetch(session, url)
        if not html:
            continue

        state = _extraer_state(html)
        if not state:
            continue

        postings = state.get("listStore", {}).get("listPostings", [])

        for p in postings:
            try:
                titulo = (p.get("generatedTitle") or p.get("title") or "").strip()
                slug   = p.get("url") or ""
                url_p  = f"{BASE}{slug}" if slug.startswith("/") else slug

                ops       = p.get("priceOperationTypes") or []
                precio_usd = None
                precio_str = "Consultar"
                if ops:
                    precios = ops[0].get("prices") or []
                    if precios:
                        pr     = precios[0]
                        monto  = pr.get("amount")
                        moneda = pr.get("currency") or ""
                        fmt    = pr.get("formattedAmount") or str(monto or "")
                        precio_str = f"USD {fmt}" if moneda == "USD" else f"{moneda} {fmt}".strip()
                        if moneda == "USD" and monto:
                            try:
                                precio_usd = float(str(monto).replace(",", ""))
                            except Exception:
                                pass

                m2, ambientes = _extraer_m2_ambientes(p)

                pub      = p.get("publisher") or {}
                pub_type = str(pub.get("publisherTypeId") or "")
                tipo_pub = "particular" if (pub_type and pub_type != "2") else "inmobiliaria"

                # Rebaja
                rebaja = None
                if ops:
                    pct = ops[0].get("lowPricePercentage")
                    if pct:
                        rebaja = f"bajó {pct}%"

                todos.append({
                    "titulo":     titulo,
                    "precio":     precio_str,
                    "precio_usd": precio_usd,
                    "m2":         m2,
                    "ambientes":  ambientes,
                    "tipo_pub":   tipo_pub,
                    "rebaja":     rebaja,
                    "url":        url_p,
                })
            except Exception:
                continue

        time.sleep(1.5)

    # Filtrar por m² (±30% o ±25m² mínimo)
    comparables = todos
    if m2_target and todos:
        margen = max(25, int(m2_target * 0.30))
        filtrados = [c for c in todos if c["m2"] and abs(c["m2"] - m2_target) <= margen]
        if len(filtrados) >= 3:
            comparables = filtrados

    # Filtrar por ambientes si hay suficientes
    if ambientes_target and len(comparables) > 6:
        amb_filtrados = [c for c in comparables if c["ambientes"] == ambientes_target]
        if len(amb_filtrados) >= 3:
            comparables = amb_filtrados

    return comparables[:30]


def formatear_para_claude(barrio, tipo, m2_target, ambientes_target, comparables) -> str:
    """Arma el texto de comparables para pasarle a Claude."""
    if not comparables:
        return "No se encontraron comparables en Zonaprop para este barrio/tipo."

    lineas = [
        f"Barrio: {barrio.title()}",
        f"Tipo: {tipo.title()}",
    ]
    if m2_target:
        lineas.append(f"Superficie objetivo: {m2_target} m²")
    if ambientes_target:
        lineas.append(f"Ambientes objetivo: {ambientes_target}")

    # Estadísticas
    precios_usd = [c["precio_usd"] for c in comparables if c["precio_usd"]]
    m2s         = [c["m2"]         for c in comparables if c["m2"]]
    precio_m2s  = [c["precio_usd"] / c["m2"] for c in comparables
                   if c["precio_usd"] and c["m2"] and c["m2"] > 0]

    lineas.append(f"\nTotal comparables encontrados: {len(comparables)}")

    if precios_usd:
        lineas.append(f"Rango de precios: USD {min(precios_usd):,.0f} – USD {max(precios_usd):,.0f}")
        lineas.append(f"Precio promedio: USD {sum(precios_usd)/len(precios_usd):,.0f}")
    if precio_m2s:
        lineas.append(f"Precio/m² promedio: USD {sum(precio_m2s)/len(precio_m2s):,.0f}/m²")
        lineas.append(f"Rango precio/m²: USD {min(precio_m2s):,.0f} – USD {max(precio_m2s):,.0f}/m²")
    if m2s:
        lineas.append(f"Superficie promedio (comparables): {sum(m2s)/len(m2s):.0f} m²")

    particulares = sum(1 for c in comparables if c["tipo_pub"] == "particular")
    lineas.append(f"Publicados por dueño directo: {particulares} de {len(comparables)}")

    lineas.append("\nLISTADO DE COMPARABLES:")
    for i, c in enumerate(comparables, 1):
        m2_txt  = f"{c['m2']} m²" if c["m2"] else "m² s/d"
        amb_txt = f"{c['ambientes']} amb" if c["ambientes"] else ""
        extras  = " | ".join(filter(None, [m2_txt, amb_txt, c.get("rebaja"), c["tipo_pub"]]))
        lineas.append(f"{i}. {c['titulo']}")
        lineas.append(f"   Precio: {c['precio']}  |  {extras}")
        lineas.append(f"   URL: {c['url']}")

    return "\n".join(lineas)
