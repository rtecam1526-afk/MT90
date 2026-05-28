"""
MT90 Tracción — ACM Scraper
Obtiene comparables de Zonaprop, MercadoLibre y Argenprop
"""

import cloudscraper, json, re, time, math, urllib.parse, urllib.request, os
from typing import Optional
from concurrent.futures import ThreadPoolExecutor

BASE_ZP      = "https://www.zonaprop.com.ar"
_SCRAPER_KEY = os.environ.get("SCRAPER_API_KEY", "").strip()

TIPO_URL_ZP = {
    "departamento": "departamentos",
    "casa":         "casas",
    "ph":           "ph",
    "local":        "locales-comerciales",
    "oficina":      "oficinas",
}

TIPO_URL_AP = {
    "departamento": "departamento",
    "casa":         "casa",
    "ph":           "ph",
    "local":        "local-comercial",
    "oficina":      "oficina",
}

ML_CAT = {
    "departamento": "MLA1459",
    "casa":         "MLA1440",
    "ph":           "MLA1459",
    "local":        "MLA1500",
    "oficina":      "MLA1471",
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
    try:
        r = session.get(target, timeout=12)
        print(f"[ACM] GET {url} → HTTP {r.status_code} ({len(r.text)} bytes)")
        if r.status_code == 200:
            return r.text
    except Exception as e:
        print(f"[ACM] Error fetching {url}: {e}")
    return None


def _extraer_state_zp(html):
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


def _extraer_datos_posting_zp(p):
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

    addr_str = ""
    addr = p.get("postingAddress") or p.get("address") or {}
    if isinstance(addr, dict):
        street   = addr.get("street") or addr.get("name") or addr.get("streetName") or ""
        num      = str(addr.get("number") or addr.get("streetNumber") or "").strip()
        barrio_p = addr.get("neighborhood") or addr.get("barrio") or ""
        parts = []
        if street:
            parts.append(f"{street} {num}".strip() if num else street)
        if barrio_p:
            parts.append(barrio_p)
        addr_str = ", ".join(parts)

    return m2, ambientes, lat, lng, addr_str


# ── Zonaprop ──────────────────────────────────────────────────────────────────

def _buscar_zonaprop(barrio: str, tipo: str, session, paginas: int = 2) -> list:
    barrio_url = barrio.strip().lower().replace(" ", "-")
    tipo_url   = TIPO_URL_ZP.get(tipo.lower(), tipo.lower() + "s")
    resultados = []

    for pag in range(1, paginas + 1):
        if pag == 1:
            url = f"{BASE_ZP}/{tipo_url}-venta-{barrio_url}.html"
        else:
            url = f"{BASE_ZP}/{tipo_url}-venta-{barrio_url}-pagina-{pag}.html"

        html = _fetch(session, url)
        if not html:
            continue

        state = _extraer_state_zp(html)
        if not state:
            print(f"[ACM-ZP] Sin PRELOADED_STATE en: {url}")
            continue

        postings = state.get("listStore", {}).get("listPostings", [])
        print(f"[ACM-ZP] Página {pag}: {len(postings)} postings")

        for p in postings:
            try:
                titulo = (p.get("generatedTitle") or p.get("title") or "").strip()
                slug   = p.get("url") or ""
                url_p  = f"{BASE_ZP}{slug}" if slug.startswith("/") else slug

                ops        = p.get("priceOperationTypes") or []
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

                m2, ambientes, p_lat, p_lng, addr_str = _extraer_datos_posting_zp(p)

                pub      = p.get("publisher") or {}
                pub_type = str(pub.get("publisherTypeId") or "")
                tipo_pub = "particular" if (pub_type and pub_type != "2") else "inmobiliaria"

                rebaja = None
                if ops:
                    pct = ops[0].get("lowPricePercentage")
                    if pct:
                        rebaja = f"bajó {pct}%"

                resultados.append({
                    "titulo":       titulo,
                    "precio":       precio_str,
                    "precio_usd":   precio_usd,
                    "m2":           m2,
                    "ambientes":    ambientes,
                    "tipo_pub":     tipo_pub,
                    "rebaja":       rebaja,
                    "url":          url_p,
                    "addr":         addr_str,
                    "distancia_km": None,
                    "lat":          p_lat,
                    "lng":          p_lng,
                    "fuente":       "Zonaprop",
                })
            except Exception:
                continue

        time.sleep(0.5)

    print(f"[ACM-ZP] {len(resultados)} listings encontrados")
    return resultados


# ── MercadoLibre ──────────────────────────────────────────────────────────────

def _buscar_ml(barrio: str, tipo: str, m2_target=None, ambientes_target=None) -> list:
    """Busca comparables en MercadoLibre Inmuebles vía su API pública."""
    categoria = ML_CAT.get(tipo.lower(), "MLA1459")
    query     = urllib.parse.quote(f"{tipo} venta {barrio} Buenos Aires")
    url = (
        f"https://api.mercadolibre.com/sites/MLA/search"
        f"?category={categoria}&q={query}&limit=50"
    )
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "MT90-ACM/1.0"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode())
    except Exception as e:
        print(f"[ACM-ML] Error: {e}")
        return []

    resultados = []
    for item in data.get("results", []):
        try:
            moneda = item.get("currency_id", "")
            monto  = item.get("price")
            precio_usd = None
            precio_str = "Consultar"
            if monto:
                if moneda == "USD":
                    precio_usd = float(monto)
                    precio_str = f"USD {monto:,.0f}"
                else:
                    precio_str = f"{moneda} {monto:,.0f}"

            m2        = None
            ambientes = None
            for attr in item.get("attributes", []):
                attr_id = attr.get("id", "").upper()
                val     = attr.get("value_name") or ""
                if "TOTAL_AREA" in attr_id or "COVERED_AREA" in attr_id:
                    mo = re.search(r'(\d+)', str(val))
                    if mo:
                        m2 = int(mo.group(1))
                elif "ROOMS" in attr_id:
                    mo = re.search(r'(\d+)', str(val))
                    if mo:
                        ambientes = int(mo.group(1))

            titulo = item.get("title", "")
            if not m2:
                mo = re.search(r'(\d+)\s*m[²2]', titulo, re.IGNORECASE)
                if mo:
                    m2 = int(mo.group(1))
            if not ambientes:
                mo = re.search(r'(\d+)\s*amb', titulo, re.IGNORECASE)
                if mo:
                    ambientes = int(mo.group(1))

            location = item.get("location") or {}
            addr_str = (location.get("address_line") or
                        (location.get("neighborhood") or {}).get("name") or
                        barrio.title())

            resultados.append({
                "titulo":       titulo,
                "precio":       precio_str,
                "precio_usd":   precio_usd,
                "m2":           m2,
                "ambientes":    ambientes,
                "tipo_pub":     "ml",
                "rebaja":       None,
                "url":          item.get("permalink", ""),
                "addr":         addr_str,
                "distancia_km": None,
                "lat":          None,
                "lng":          None,
                "fuente":       "MercadoLibre",
            })
        except Exception:
            continue

    print(f"[ACM-ML] {len(resultados)} listings encontrados")
    return resultados


# ── Argenprop ─────────────────────────────────────────────────────────────────

def _buscar_argenprop(barrio: str, tipo: str, session, paginas: int = 1) -> list:
    """Busca comparables en Argenprop extrayendo __NEXT_DATA__."""
    tipo_ap    = TIPO_URL_AP.get(tipo.lower(), tipo.lower())
    barrio_url = barrio.strip().lower().replace(" ", "-")
    resultados = []

    for pag in range(1, paginas + 1):
        if pag == 1:
            url = f"https://www.argenprop.com/{tipo_ap}-venta-en-{barrio_url}"
        else:
            url = f"https://www.argenprop.com/{tipo_ap}-venta-en-{barrio_url}--pagina-{pag}"

        html = _fetch(session, url)
        if not html:
            continue

        m = re.search(r'<script[^>]+id=["\']__NEXT_DATA__["\'][^>]*>(.*?)</script>', html, re.DOTALL)
        if not m:
            print(f"[ACM-AP] Sin __NEXT_DATA__ en {url}")
            continue

        try:
            nd = json.loads(m.group(1))
        except Exception:
            print(f"[ACM-AP] JSON inválido en {url}")
            continue

        # Buscar listings dentro de la estructura de Next.js (varía por versión)
        listings = []
        try:
            props = nd.get("props", {}).get("pageProps", {})
            for key in ["listings", "data", "initialData", "searchResults", "results"]:
                candidate = props.get(key)
                if isinstance(candidate, list) and candidate:
                    listings = candidate
                    break
                if isinstance(candidate, dict):
                    for subkey in ["listings", "results", "items"]:
                        sub = candidate.get(subkey)
                        if isinstance(sub, list) and sub:
                            listings = sub
                            break
                if listings:
                    break
        except Exception:
            pass

        if not listings:
            print(f"[ACM-AP] No se encontraron listings en página {pag}")
            continue

        for item in listings:
            try:
                posting = item.get("posting") or item.get("data") or item

                precio_usd = None
                precio_str = "Consultar"
                price_data = (posting.get("price") or posting.get("prices") or
                              posting.get("operationTypes") or {})

                if isinstance(price_data, dict):
                    monto  = price_data.get("amount") or price_data.get("value")
                    moneda = str(price_data.get("currency") or price_data.get("currencyCode") or "")
                    if monto and "USD" in moneda.upper():
                        precio_usd = float(str(monto).replace(",", ""))
                        precio_str = f"USD {precio_usd:,.0f}"
                elif isinstance(price_data, list) and price_data:
                    p0     = price_data[0]
                    moneda = str(p0.get("currency") or p0.get("currencyCode") or "")
                    monto  = (p0.get("prices") or [{}])[0].get("amount") if p0.get("prices") else p0.get("amount")
                    if monto and "USD" in moneda.upper():
                        precio_usd = float(str(monto).replace(",", ""))
                        precio_str = f"USD {precio_usd:,.0f}"

                titulo = posting.get("title") or posting.get("generatedTitle") or ""
                url_p  = posting.get("url") or posting.get("postingUrl") or posting.get("link") or ""
                if url_p and not url_p.startswith("http"):
                    url_p = "https://www.argenprop.com" + url_p

                m2        = None
                ambientes = None
                for attr in (posting.get("attributes") or posting.get("features") or []):
                    attr_id = str(attr.get("id") or attr.get("key") or attr.get("attributeId") or "").upper()
                    val     = str(attr.get("value") or attr.get("valueName") or
                                  (attr.get("values") or [{}])[0].get("name") or "")
                    if any(x in attr_id for x in ["SURFACE", "M2", "AREA", "TOTALAREA"]):
                        mo = re.search(r'(\d+)', val)
                        if mo:
                            m2 = int(mo.group(1))
                    elif any(x in attr_id for x in ["ROOM", "AMBIENT", "AMBIENTES"]):
                        mo = re.search(r'(\d+)', val)
                        if mo:
                            ambientes = int(mo.group(1))

                if not m2:
                    mo = re.search(r'(\d+)\s*m[²2]', titulo, re.IGNORECASE)
                    if mo:
                        m2 = int(mo.group(1))
                if not ambientes:
                    mo = re.search(r'(\d+)\s*amb', titulo, re.IGNORECASE)
                    if mo:
                        ambientes = int(mo.group(1))

                if not titulo and not precio_usd:
                    continue

                resultados.append({
                    "titulo":       titulo,
                    "precio":       precio_str,
                    "precio_usd":   precio_usd,
                    "m2":           m2,
                    "ambientes":    ambientes,
                    "tipo_pub":     "inmobiliaria",
                    "rebaja":       None,
                    "url":          url_p,
                    "addr":         barrio.title(),
                    "distancia_km": None,
                    "lat":          None,
                    "lng":          None,
                    "fuente":       "Argenprop",
                })
            except Exception:
                continue

        time.sleep(0.5)

    print(f"[ACM-AP] {len(resultados)} listings encontrados")
    return resultados


# ── Agregador principal ───────────────────────────────────────────────────────

def buscar_comparables(barrio: str, tipo: str, m2_target: Optional[int] = None,
                       ambientes_target: Optional[int] = None, paginas: int = 1,
                       direccion: Optional[str] = None, radio_km: float = 1.0,
                       progress_cb=None) -> list:
    """
    Busca comparables en Zonaprop + MercadoLibre + Argenprop en paralelo.
    progress_cb(msg): callback opcional para emitir mensajes de progreso.
    """
    def _cb(msg):
        if progress_cb:
            try:
                progress_cb(msg)
            except Exception:
                pass

    # Geocodificar dirección objetivo si se provee
    target_lat = target_lng = None
    if direccion:
        _cb(f"📍 Geocodificando {direccion}...")
        coords = _geocodificar(direccion, barrio)
        if coords:
            target_lat, target_lng = coords
        else:
            _cb("⚠️ No se pudo geocodificar la dirección, usando barrio completo")

    # Scrapers en paralelo — cada uno con su propia sesión
    def _run_zp():
        _cb(f"🔎 Consultando **Zonaprop** ({barrio.title()})...")
        r = _buscar_zonaprop(barrio, tipo, _crear_session(), paginas)
        _cb(f"✓ Zonaprop: {len(r)} propiedades")
        return r

    def _run_ml():
        _cb(f"🔎 Consultando **MercadoLibre** ({barrio.title()})...")
        r = _buscar_ml(barrio, tipo, m2_target, ambientes_target)
        _cb(f"✓ MercadoLibre: {len(r)} propiedades")
        return r

    def _run_ap():
        _cb(f"🔎 Consultando **Argenprop** ({barrio.title()})...")
        r = _buscar_argenprop(barrio, tipo, _crear_session(), paginas=1)
        _cb(f"✓ Argenprop: {len(r)} propiedades")
        return r

    todos_zp = todos_ml = todos_ap = []
    with ThreadPoolExecutor(max_workers=3) as ex:
        fut_zp = ex.submit(_run_zp)
        fut_ml = ex.submit(_run_ml)
        fut_ap = ex.submit(_run_ap)
        for fut, name in [(fut_zp, "ZP"), (fut_ml, "ML"), (fut_ap, "AP")]:
            try:
                result = fut.result(timeout=35)
                if name == "ZP":
                    todos_zp = result
                elif name == "ML":
                    todos_ml = result
                else:
                    todos_ap = result
            except Exception as e:
                print(f"[ACM-{name}] Timeout o error: {e}")
                _cb(f"⚠️ {'Zonaprop' if name=='ZP' else 'MercadoLibre' if name=='ML' else 'Argenprop'} no respondió a tiempo")

    # Calcular distancias para comparables de Zonaprop que tienen coordenadas
    if target_lat and target_lng:
        for c in todos_zp:
            if c.get("lat") and c.get("lng"):
                c["distancia_km"] = _distancia_km(target_lat, target_lng, c["lat"], c["lng"])

    # Unificar
    todos = todos_zp + todos_ml + todos_ap

    # Filtrar por radio si tenemos coordenadas (solo para los que tienen distancia)
    if target_lat and target_lng:
        con_dist = [c for c in todos if c.get("distancia_km") is not None]
        if con_dist:
            en_radio = [c for c in con_dist if c["distancia_km"] <= radio_km]
            sin_dist = [c for c in todos if c.get("distancia_km") is None]
            if len(en_radio) >= 3:
                todos = en_radio + sin_dist[:10]
                print(f"[ACM] Filtro radio {radio_km}km: {len(en_radio)} ZP + {len(sin_dist[:10])} sin coords")
            else:
                en_radio2 = [c for c in con_dist if c["distancia_km"] <= radio_km * 2]
                sin_dist  = [c for c in todos if c.get("distancia_km") is None]
                if len(en_radio2) >= 3:
                    todos = en_radio2 + sin_dist[:10]
                else:
                    print(f"[ACM] Radio amplio insuficiente, usando todos")

    # Filtrar por m² (±30% o mínimo ±25m²)
    if m2_target and todos:
        margen    = max(25, int(m2_target * 0.30))
        filtrados = [c for c in todos if c["m2"] and abs(c["m2"] - m2_target) <= margen]
        if len(filtrados) >= 6:
            todos = filtrados

    # Filtrar por ambientes si hay suficientes
    if ambientes_target and len(todos) > 8:
        amb_filtrados = [c for c in todos if c["ambientes"] == ambientes_target]
        if len(amb_filtrados) >= 4:
            todos = amb_filtrados

    # Ordenar: primero por distancia (los que tienen), luego el resto
    con_dist = [c for c in todos if c.get("distancia_km") is not None]
    sin_dist = [c for c in todos if c.get("distancia_km") is None]
    con_dist.sort(key=lambda c: c["distancia_km"])
    todos = con_dist + sin_dist

    return todos[:40]


def formatear_para_claude(barrio, tipo, m2_target, ambientes_target, comparables,
                          direccion=None, radio_km=None) -> str:
    """Arma el texto de comparables multi-fuente para pasarle a Claude."""
    if not comparables:
        return "No se encontraron comparables en ningún portal para ese barrio/tipo."

    lineas = [f"Barrio: {barrio.title()}", f"Tipo: {tipo.title()}"]
    if direccion:
        lineas.append(f"Dirección objetivo: {direccion}")
        if radio_km:
            lineas.append(f"Radio de búsqueda: {radio_km} km")
    if m2_target:
        lineas.append(f"Superficie objetivo: {m2_target} m²")
    if ambientes_target:
        lineas.append(f"Ambientes objetivo: {ambientes_target}")

    # Resumen general
    precios_usd = [c["precio_usd"] for c in comparables if c["precio_usd"]]
    m2s         = [c["m2"]         for c in comparables if c["m2"]]
    precio_m2s  = [c["precio_usd"] / c["m2"] for c in comparables
                   if c["precio_usd"] and c["m2"] and c["m2"] > 0]

    lineas.append(f"\nTOTAL COMPARABLES (todas las fuentes): {len(comparables)}")
    if precios_usd:
        lineas.append(f"Rango de precios: USD {min(precios_usd):,.0f} – USD {max(precios_usd):,.0f}")
        lineas.append(f"Precio promedio publicado: USD {sum(precios_usd)/len(precios_usd):,.0f}")
    if precio_m2s:
        lineas.append(f"Precio/m² promedio: USD {sum(precio_m2s)/len(precio_m2s):,.0f}/m²")
        lineas.append(f"Rango precio/m²: USD {min(precio_m2s):,.0f} – USD {max(precio_m2s):,.0f}/m²")
    if m2s:
        lineas.append(f"Superficie promedio comparables: {sum(m2s)/len(m2s):.0f} m²")

    # Resumen por fuente
    fuentes = {}
    for c in comparables:
        f = c.get("fuente", "Desconocido")
        fuentes.setdefault(f, []).append(c)

    lineas.append("\nRESUMEN POR PORTAL:")
    for fuente, items in fuentes.items():
        p_usd = [c["precio_usd"] for c in items if c["precio_usd"]]
        pm2   = [c["precio_usd"] / c["m2"] for c in items if c["precio_usd"] and c["m2"] and c["m2"] > 0]
        if p_usd:
            lineas.append(
                f"  {fuente}: {len(items)} propiedades | "
                f"promedio USD {sum(p_usd)/len(p_usd):,.0f} | "
                + (f"USD {sum(pm2)/len(pm2):,.0f}/m²" if pm2 else "m² s/d")
            )
        else:
            lineas.append(f"  {fuente}: {len(items)} propiedades (sin precios USD)")

    # Listado completo
    lineas.append("\nLISTADO DE COMPARABLES:")
    for i, c in enumerate(comparables, 1):
        fuente_tag = f"[{c.get('fuente','?')}]"
        m2_txt     = f"{c['m2']} m²" if c["m2"] else "m² s/d"
        amb_txt    = f"{c['ambientes']} amb" if c["ambientes"] else ""
        dist_txt   = f"{c['distancia_km']:.2f}km" if c.get("distancia_km") is not None else ""
        extras     = " | ".join(filter(None, [m2_txt, amb_txt, dist_txt, c.get("rebaja"), c.get("tipo_pub")]))
        lineas.append(f"{i}. {fuente_tag} {c['titulo']}")
        if c.get("addr"):
            lineas.append(f"   Dirección: {c['addr']}")
        lineas.append(f"   Precio: {c['precio']}  |  {extras}")
        lineas.append(f"   URL: {c['url']}")

    return "\n".join(lineas)
