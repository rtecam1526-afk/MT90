"""
MT90 Tracción — ACM Scraper
Obtiene comparables de Zonaprop para generar el ACM
"""

import cloudscraper, json, re, time, math, urllib.parse, urllib.request, os
from typing import Optional

BASE = "https://www.zonaprop.com.ar"
_SCRAPER_KEY = os.environ.get("SCRAPER_API_KEY", "").strip()

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
    if _SCRAPER_KEY:
        target = f"http://api.scraperapi.com?api_key={_SCRAPER_KEY}&url={urllib.parse.quote(url, safe='')}&country_code=ar"
    else:
        target = url
    for i in range(3):
        try:
            r = session.get(target, timeout=40)
            print(f"[ACM] GET {url} → HTTP {r.status_code} ({len(r.text)} bytes)")
            if r.status_code == 200:
                return r.text
            time.sleep(3 * (i + 1))
        except Exception as e:
            print(f"[ACM] Error fetching {url}: {e}")
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

def _distancia_km(lat1, lng1, lat2, lng2):
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (math.sin(dlat/2)**2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng/2)**2)
    return R * 2 * math.asin(math.sqrt(a))

def _geocodificar(direccion: str, barrio: str = "") -> Optional[tuple]:
    """Geocodifica con Nominatim (OSM). Retorna (lat, lng) o None."""
    query = f"{direccion}, {barrio}, Buenos Aires, Argentina" if barrio else f"{direccion}, Buenos Aires, Argentina"
    try:
        q = urllib.parse.quote(query)
        req = urllib.request.Request(
            f"https://nominatim.openstreetmap.org/search?q={q}&format=json&limit=1&countrycodes=ar",
            headers={"User-Agent": "MT90-ACM/1.0 (captacion inmobiliaria)"}
        )
        with urllib.request.urlopen(req, timeout=8) as resp:
            results = json.loads(resp.read().decode())
        if results:
            lat, lng = float(results[0]["lat"]), float(results[0]["lon"])
            print(f"[ACM] Geocodificado: '{query}' → ({lat:.4f}, {lng:.4f})")
            return lat, lng
    except Exception as e:
        print(f"[ACM] Error geocodificando '{query}': {e}")
    return None

def _extraer_datos_posting(p):
    """Extrae m2, ambientes, coordenadas y dirección de un posting."""
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

    # Coordenadas del posting
    lat = lng = None
    geo = p.get("geo") or {}
    if isinstance(geo, dict):
        try:
            lat_v = geo.get("lat") or geo.get("latitude")
            lng_v = geo.get("lon") or geo.get("longitude") or geo.get("lng")
            if lat_v is not None:
                lat = float(lat_v)
            if lng_v is not None:
                lng = float(lng_v)
        except Exception:
            lat = lng = None

    # Dirección textual del posting
    addr_str = ""
    addr = p.get("postingAddress") or p.get("address") or {}
    if isinstance(addr, dict):
        street = addr.get("street") or addr.get("name") or addr.get("streetName") or ""
        num    = str(addr.get("number") or addr.get("streetNumber") or "").strip()
        barrio_p = addr.get("neighborhood") or addr.get("barrio") or ""
        parts = []
        if street:
            parts.append(f"{street} {num}".strip() if num else street)
        if barrio_p:
            parts.append(barrio_p)
        addr_str = ", ".join(parts)

    return m2, ambientes, lat, lng, addr_str


def buscar_comparables(barrio: str, tipo: str, m2_target: Optional[int] = None,
                       ambientes_target: Optional[int] = None, paginas: int = 2,
                       direccion: Optional[str] = None, radio_km: float = 1.0) -> list:
    """
    Busca comparables en Zonaprop para barrio+tipo.
    Si se provee 'direccion', geocodifica y filtra por radio (default 1 km).
    Filtra también por m² y ambientes si se especifican.
    Retorna lista de dicts: titulo, precio, precio_usd, m2, ambientes, tipo_pub,
                            url, addr, distancia_km, rebaja
    """
    barrio_url = barrio.strip().lower().replace(" ", "-")
    tipo_url   = TIPO_URL.get(tipo.lower(), tipo.lower() + "s")
    session    = _crear_session()
    todos      = []

    # Geocodificar dirección objetivo si se provee
    target_lat = target_lng = None
    if direccion:
        coords = _geocodificar(direccion, barrio)
        if coords:
            target_lat, target_lng = coords
        else:
            print(f"[ACM] No se pudo geocodificar '{direccion}', se usa barrio completo")

    for pag in range(1, paginas + 1):
        if pag == 1:
            url = f"{BASE}/{tipo_url}-venta-{barrio_url}.html"
        else:
            url = f"{BASE}/{tipo_url}-venta-{barrio_url}-pagina-{pag}.html"

        html = _fetch(session, url)
        if not html:
            print(f"[ACM] Sin respuesta: {url}")
            continue

        state = _extraer_state(html)
        if not state:
            print(f"[ACM] Sin PRELOADED_STATE en: {url}")
            print(f"[ACM] Primeros 300 chars: {html[:300]}")
            continue

        postings = state.get("listStore", {}).get("listPostings", [])
        print(f"[ACM] Página {pag}: {len(postings)} postings encontrados")

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

                m2, ambientes, p_lat, p_lng, addr_str = _extraer_datos_posting(p)

                # Calcular distancia al objetivo
                distancia = None
                if target_lat and target_lng and p_lat and p_lng:
                    distancia = _distancia_km(target_lat, target_lng, p_lat, p_lng)

                pub      = p.get("publisher") or {}
                pub_type = str(pub.get("publisherTypeId") or "")
                tipo_pub = "particular" if (pub_type and pub_type != "2") else "inmobiliaria"

                rebaja = None
                if ops:
                    pct = ops[0].get("lowPricePercentage")
                    if pct:
                        rebaja = f"bajó {pct}%"

                todos.append({
                    "titulo":       titulo,
                    "precio":       precio_str,
                    "precio_usd":   precio_usd,
                    "m2":           m2,
                    "ambientes":    ambientes,
                    "tipo_pub":     tipo_pub,
                    "rebaja":       rebaja,
                    "url":          url_p,
                    "addr":         addr_str,
                    "distancia_km": distancia,
                })
            except Exception:
                continue

        time.sleep(1.5)

    comparables = todos

    # Filtrar por radio si tenemos coordenadas objetivo Y coordenadas de postings
    if target_lat and target_lng and todos:
        con_dist = [c for c in todos if c["distancia_km"] is not None]
        if con_dist:
            en_radio = [c for c in con_dist if c["distancia_km"] <= radio_km]
            if len(en_radio) >= 3:
                comparables = en_radio
                print(f"[ACM] Filtro radio {radio_km}km: {len(comparables)} comparables")
            else:
                # Ampliar radio automáticamente hasta tener suficientes
                en_radio2 = [c for c in con_dist if c["distancia_km"] <= radio_km * 2]
                if len(en_radio2) >= 3:
                    comparables = en_radio2
                    print(f"[ACM] Radio ampliado a {radio_km*2:.1f}km: {len(comparables)} comparables")
                else:
                    print(f"[ACM] Pocos postings con coordenadas ({len(con_dist)}), usando todos")
        else:
            print(f"[ACM] Postings sin coordenadas — filtro por radio no disponible")

    # Filtrar por m² (±30% o mínimo ±25m²)
    if m2_target and comparables:
        margen    = max(25, int(m2_target * 0.30))
        filtrados = [c for c in comparables if c["m2"] and abs(c["m2"] - m2_target) <= margen]
        if len(filtrados) >= 3:
            comparables = filtrados

    # Filtrar por ambientes si hay suficientes
    if ambientes_target and len(comparables) > 6:
        amb_filtrados = [c for c in comparables if c["ambientes"] == ambientes_target]
        if len(amb_filtrados) >= 3:
            comparables = amb_filtrados

    # Ordenar por distancia cuando está disponible
    if target_lat and target_lng:
        comparables.sort(key=lambda c: c["distancia_km"] if c["distancia_km"] is not None else 9999)

    return comparables[:30]


def formatear_para_claude(barrio, tipo, m2_target, ambientes_target, comparables,
                          direccion=None, radio_km=None) -> str:
    """Arma el texto de comparables para pasarle a Claude."""
    if not comparables:
        return "No se encontraron comparables en Zonaprop para ese barrio/tipo."

    lineas = [f"Barrio: {barrio.title()}", f"Tipo: {tipo.title()}"]
    if direccion:
        lineas.append(f"Dirección objetivo: {direccion}")
        if radio_km:
            lineas.append(f"Radio de búsqueda: {radio_km} km")
    if m2_target:
        lineas.append(f"Superficie objetivo: {m2_target} m²")
    if ambientes_target:
        lineas.append(f"Ambientes objetivo: {ambientes_target}")

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
        m2_txt   = f"{c['m2']} m²" if c["m2"] else "m² s/d"
        amb_txt  = f"{c['ambientes']} amb" if c["ambientes"] else ""
        dist_txt = f"{c['distancia_km']:.2f}km del objetivo" if c.get("distancia_km") is not None else ""
        extras   = " | ".join(filter(None, [m2_txt, amb_txt, dist_txt, c.get("rebaja"), c["tipo_pub"]]))
        lineas.append(f"{i}. {c['titulo']}")
        if c.get("addr"):
            lineas.append(f"   Dirección: {c['addr']}")
        lineas.append(f"   Precio: {c['precio']}  |  {extras}")
        lineas.append(f"   URL: {c['url']}")

    return "\n".join(lineas)
