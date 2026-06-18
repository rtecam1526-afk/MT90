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


def _slug(texto: str) -> str:
    """Normaliza texto a slug de URL: minúsculas, sin tildes, guiones."""
    trans = str.maketrans("áéíóúüñÁÉÍÓÚÜÑ", "aeiouunAEIOUUN")
    return texto.translate(trans).lower().strip().replace(" ", "-")


def _detectar_partido_zonaprop(barrio: str) -> Optional[str]:
    """
    Llama a Nominatim con addressdetails=1 para detectar si 'barrio' es una
    localidad de GBA y extraer el partido. Devuelve el slug del partido para
    armar la URL de Zonaprop (ej: 'avellaneda'), o None si es CABA/no detectado.
    """
    query = f"{barrio}, Buenos Aires, Argentina"
    try:
        q = urllib.parse.quote(query)
        req = urllib.request.Request(
            f"https://nominatim.openstreetmap.org/search?q={q}&format=json&limit=1"
            f"&countrycodes=ar&addressdetails=1",
            headers={"User-Agent": "MT90-ACM/1.0 (captacion inmobiliaria)"}
        )
        with urllib.request.urlopen(req, timeout=8) as resp:
            results = json.loads(resp.read().decode())
        if not results:
            return None
        addr  = results[0].get("address", {})
        state = addr.get("state", "")
        city  = addr.get("city", "") or addr.get("town", "") or addr.get("municipality", "")
        # CABA se llama "Ciudad Autónoma de Buenos Aires" o city == "Buenos Aires"
        if "autónoma" in state.lower() or city.lower() in ("buenos aires", "ciudad de buenos aires"):
            return None  # Es CABA, no necesita partido
        # GBA: extraer partido del campo county o city_district
        county = addr.get("county", "") or addr.get("city_district", "")
        if county:
            partido = _slug(county.replace("Partido de ", "").replace("partido de ", ""))
            print(f"[ACM-ZP] Partido detectado via Nominatim: '{partido}' (county='{county}')")
            return partido
    except Exception as e:
        print(f"[ACM-ZP] Error detectando partido para '{barrio}': {e}")
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

def _zp_postings(session, tipo_url: str, barrio_url: str, pag: int) -> list:
    """Descarga una página de Zonaprop y devuelve la lista de postings (puede ser [])."""
    if pag == 1:
        url = f"{BASE_ZP}/{tipo_url}-venta-{barrio_url}.html"
    else:
        url = f"{BASE_ZP}/{tipo_url}-venta-{barrio_url}-pagina-{pag}.html"
    html = _fetch(session, url)
    if not html:
        return []
    state = _extraer_state_zp(html)
    if not state:
        print(f"[ACM-ZP] Sin PRELOADED_STATE en: {url}")
        return []
    postings = state.get("listStore", {}).get("listPostings", [])
    print(f"[ACM-ZP] {url}: {len(postings)} postings")
    return postings


def _buscar_zonaprop(barrio: str, tipo: str, session, paginas: int = 2) -> list:
    barrio_url = _slug(barrio)
    tipo_url   = TIPO_URL_ZP.get(tipo.lower(), tipo.lower() + "s")
    resultados = []

    # Página 1: primer intento con el barrio tal como viene
    postings_p1 = _zp_postings(session, tipo_url, barrio_url, 1)

    # Si no hay resultados y el slug no tiene partido, intentar detectarlo via Nominatim
    if not postings_p1:
        partido = _detectar_partido_zonaprop(barrio)
        if partido:
            barrio_con_partido = f"{barrio_url}-{partido}"
            postings_p1 = _zp_postings(session, tipo_url, barrio_con_partido, 1)
            if postings_p1:
                barrio_url = barrio_con_partido  # usar este slug para las páginas siguientes

    def _procesar(postings):
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

    _procesar(postings_p1)
    for pag in range(2, paginas + 1):
        _procesar(_zp_postings(session, tipo_url, barrio_url, pag))
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
    if _SCRAPER_KEY:
        fetch_url = f"http://api.scraperapi.com?api_key={_SCRAPER_KEY}&url={urllib.parse.quote(url, safe='')}"
    else:
        fetch_url = url
    try:
        session = _crear_session()
        r = session.get(fetch_url, timeout=15,
                        headers={"Accept": "application/json",
                                 "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"})
        if r.status_code != 200:
            print(f"[ACM-ML] HTTP {r.status_code}")
            return []
        data = r.json()
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


# ── Reporte Inmobiliario ──────────────────────────────────────────────────────

TIPO_URL_RI = {
    "departamento": "departamentos",
    "casa":         "casas",
    "ph":           "ph",
    "local":        "locales",
    "oficina":      "oficinas",
}

def _buscar_ri(barrio: str, tipo: str, session) -> list:
    """Busca comparables en Reporte Inmobiliario."""
    tipo_ri    = TIPO_URL_RI.get(tipo.lower(), "departamentos")
    barrio_url = _slug(barrio)
    resultados = []

    url = f"https://www.reporteinmobiliario.com/inmuebles/venta-{tipo_ri}-en-{barrio_url}"
    html = _fetch(session, url)
    if not html:
        return []

    # Intentar JSON embebido (Next.js / React)
    for pat in [
        r'<script[^>]+id=["\']__NEXT_DATA__["\'][^>]*>(.*?)</script>',
        r'window\.__PRELOADED_STATE__\s*=\s*(\{.*?\});?\s*</script>',
        r'window\.__INITIAL_STATE__\s*=\s*(\{.*?\});?\s*</script>',
    ]:
        m_json = re.search(pat, html, re.DOTALL)
        if not m_json:
            continue
        try:
            blob = json.loads(m_json.group(1))
            def _find_listings_ri(obj, depth=0):
                if depth > 7:
                    return []
                if isinstance(obj, list) and len(obj) > 2:
                    sample = obj[0] if obj else {}
                    if isinstance(sample, dict) and any(
                        k in sample for k in ["price", "precio", "priceOperationTypes"]
                    ):
                        return obj
                if isinstance(obj, dict):
                    for v in obj.values():
                        r = _find_listings_ri(v, depth + 1)
                        if r:
                            return r
                return []
            found = _find_listings_ri(blob)
            for item in found:
                try:
                    precio_usd = None
                    precio_str = "Consultar"
                    for pk in ["price", "precio"]:
                        pd = item.get(pk)
                        if isinstance(pd, (int, float)) and pd > 0:
                            precio_usd = float(pd)
                            precio_str = f"USD {precio_usd:,.0f}"
                            break
                        if isinstance(pd, dict):
                            amt = pd.get("amount") or pd.get("value")
                            cur = str(pd.get("currency") or pd.get("currencyCode") or "")
                            if amt and "USD" in cur.upper():
                                precio_usd = float(str(amt).replace(",", ""))
                                precio_str = f"USD {precio_usd:,.0f}"
                                break

                    m2_v = None
                    amb_v = None
                    titulo = str(item.get("title") or item.get("titulo") or "")
                    for k in ["surface", "m2", "totalSurface", "coveredSurface", "superficieTotal"]:
                        v = item.get(k)
                        if v:
                            mo = re.search(r'(\d+)', str(v))
                            if mo:
                                m2_v = int(mo.group(1))
                                break
                    if not m2_v:
                        mo = re.search(r'(\d+)\s*m[²2]', titulo, re.IGNORECASE)
                        if mo:
                            m2_v = int(mo.group(1))
                    for k in ["rooms", "ambientes", "environments"]:
                        v = item.get(k)
                        if v:
                            mo = re.search(r'(\d+)', str(v))
                            if mo:
                                amb_v = int(mo.group(1))
                                break
                    if not amb_v:
                        mo = re.search(r'(\d+)\s*amb', titulo, re.IGNORECASE)
                        if mo:
                            amb_v = int(mo.group(1))

                    addr = (item.get("address") or item.get("direccion") or
                            item.get("location") or barrio.title())
                    if isinstance(addr, dict):
                        addr = (addr.get("street") or addr.get("name") or
                                addr.get("address_line") or barrio.title())

                    if not precio_usd:
                        continue
                    resultados.append({
                        "titulo":       titulo,
                        "precio":       precio_str,
                        "precio_usd":   precio_usd,
                        "m2":           m2_v,
                        "ambientes":    amb_v,
                        "tipo_pub":     "inmobiliaria",
                        "rebaja":       None,
                        "url":          item.get("url") or item.get("permalink") or url,
                        "addr":         str(addr),
                        "distancia_km": None,
                        "lat":          None,
                        "lng":          None,
                        "fuente":       "Reporte Inmobiliario",
                    })
                except Exception:
                    continue
            if resultados:
                break
        except Exception:
            continue

    # Fallback: extracción directa de HTML si no hubo JSON
    if not resultados:
        precios = re.findall(r'USD\s*[\$]?\s*([\d\.,]+)', html)
        m2s     = re.findall(r'(\d{2,4})\s*m[²2]', html, re.IGNORECASE)
        ambs    = re.findall(r'(\d)\s*amb', html, re.IGNORECASE)
        for i, p_str in enumerate(precios[:15]):
            try:
                p_val = float(p_str.replace(".", "").replace(",", "."))
                if p_val < 5000 or p_val > 10_000_000:
                    continue
                resultados.append({
                    "titulo":       f"{tipo.title()} en {barrio.title()}",
                    "precio":       f"USD {p_val:,.0f}",
                    "precio_usd":   p_val,
                    "m2":           int(m2s[i]) if i < len(m2s) else None,
                    "ambientes":    int(ambs[i]) if i < len(ambs) else None,
                    "tipo_pub":     "inmobiliaria",
                    "rebaja":       None,
                    "url":          url,
                    "addr":         barrio.title(),
                    "distancia_km": None,
                    "lat":          None,
                    "lng":          None,
                    "fuente":       "Reporte Inmobiliario",
                })
            except Exception:
                continue

    print(f"[ACM-RI] {len(resultados)} listings encontrados")
    return resultados


# ── Argenprop ─────────────────────────────────────────────────────────────────

def _buscar_argenprop(barrio: str, tipo: str, session, paginas: int = 1) -> list:
    """
    Busca comparables en Argenprop.
    Intenta primero JSON embebido (__NEXT_DATA__ / __PRELOADED_STATE__),
    luego extracción directa del HTML renderizado.
    """
    tipo_ap    = TIPO_URL_AP.get(tipo.lower(), tipo.lower())
    barrio_url = _slug(barrio)
    resultados = []

    for pag in range(1, paginas + 1):
        if pag == 1:
            url = f"https://www.argenprop.com/{tipo_ap}-venta-en-{barrio_url}"
        else:
            url = f"https://www.argenprop.com/{tipo_ap}-venta-en-{barrio_url}--pagina-{pag}"

        html = _fetch(session, url)
        if not html:
            continue

        extraidos = []

        # Intento 1: cualquier bloque JSON grande embebido en <script>
        for pat in [
            r'window\.__PRELOADED_STATE__\s*=\s*(\{.*?\});?\s*</script>',
            r'window\.__INITIAL_STATE__\s*=\s*(\{.*?\});?\s*</script>',
            r'<script[^>]+id=["\']__NEXT_DATA__["\'][^>]*>(.*?)</script>',
        ]:
            m_json = re.search(pat, html, re.DOTALL)
            if not m_json:
                continue
            try:
                blob = json.loads(m_json.group(1))
                # Buscar recursivamente arrays con campo 'price' o 'precio'
                def _find_listings(obj, depth=0):
                    if depth > 6:
                        return []
                    if isinstance(obj, list) and len(obj) > 2:
                        sample = obj[0] if obj else {}
                        if isinstance(sample, dict) and any(
                            k in sample for k in ["price","precio","priceOperationTypes","operationTypes"]
                        ):
                            return obj
                    if isinstance(obj, dict):
                        for v in obj.values():
                            r = _find_listings(v, depth+1)
                            if r:
                                return r
                    return []

                found = _find_listings(blob)
                if found:
                    for item in found:
                        try:
                            precio_usd = None
                            precio_str = "Consultar"
                            for pk in ["price","precio","priceOperationTypes","operationTypes"]:
                                pd = item.get(pk)
                                if not pd:
                                    continue
                                if isinstance(pd, (int,float)):
                                    precio_usd = float(pd)
                                    precio_str = f"USD {precio_usd:,.0f}"
                                    break
                                if isinstance(pd, dict):
                                    amt = pd.get("amount") or pd.get("value")
                                    cur = str(pd.get("currency") or pd.get("currencyCode") or "")
                                    if amt and "USD" in cur.upper():
                                        precio_usd = float(str(amt).replace(",",""))
                                        precio_str = f"USD {precio_usd:,.0f}"
                                        break
                                if isinstance(pd, list) and pd:
                                    p0  = pd[0]
                                    sub = (p0.get("prices") or [{}])[0] if isinstance(p0,dict) else {}
                                    amt = sub.get("amount") or (p0.get("amount") if isinstance(p0,dict) else None)
                                    cur = str((p0.get("currency") or "") if isinstance(p0,dict) else "")
                                    if amt and "USD" in cur.upper():
                                        precio_usd = float(str(amt).replace(",",""))
                                        precio_str = f"USD {precio_usd:,.0f}"
                                        break
                            titulo = str(item.get("title") or item.get("generatedTitle") or "")
                            url_p  = str(item.get("url") or item.get("postingUrl") or item.get("link") or "")
                            if url_p and not url_p.startswith("http"):
                                url_p = "https://www.argenprop.com" + url_p
                            m2 = ambientes = None
                            for attr in (item.get("attributes") or item.get("features") or []):
                                aid = str(attr.get("id") or attr.get("key") or "").upper()
                                val = str(attr.get("value") or attr.get("valueName") or "")
                                if any(x in aid for x in ["SURFACE","M2","AREA"]):
                                    mo = re.search(r'(\d+)', val)
                                    if mo: m2 = int(mo.group(1))
                                elif any(x in aid for x in ["ROOM","AMBIENT"]):
                                    mo = re.search(r'(\d+)', val)
                                    if mo: ambientes = int(mo.group(1))
                            if not m2:
                                mo = re.search(r'(\d+)\s*m[²2]', titulo, re.IGNORECASE)
                                if mo: m2 = int(mo.group(1))
                            if precio_usd or titulo:
                                extraidos.append({
                                    "titulo": titulo, "precio": precio_str,
                                    "precio_usd": precio_usd, "m2": m2,
                                    "ambientes": ambientes, "tipo_pub": "inmobiliaria",
                                    "rebaja": None, "url": url_p, "addr": barrio.title(),
                                    "distancia_km": None, "lat": None, "lng": None,
                                    "fuente": "Argenprop",
                                })
                        except Exception:
                            continue
                    if extraidos:
                        break
            except Exception:
                continue

        # Intento 2: parseo directo del HTML (cards de propiedades)
        if not extraidos:
            # Buscar precios USD y m² en el texto del HTML
            precios = re.findall(r'USD\s*([\d\.,]+)', html)
            m2s     = re.findall(r'(\d{2,4})\s*m[²2]\s*(?:cub|tot|cubie)', html, re.IGNORECASE)
            urls_ap = re.findall(r'href=["\'](/[^"\']+(?:departamento|casa|ph)[^"\']*)["\']', html)
            print(f"[ACM-AP] Parseo HTML directo: {len(precios)} precios, {len(m2s)} m², {len(urls_ap)} URLs")
            seen = set()
            for i, precio_raw in enumerate(precios[:25]):
                try:
                    precio_usd = float(precio_raw.replace(".", "").replace(",", "."))
                    if precio_usd < 20000 or precio_usd > 5000000:
                        continue
                    m2_val = int(m2s[i]) if i < len(m2s) else None
                    url_p  = "https://www.argenprop.com" + urls_ap[i] if i < len(urls_ap) else ""
                    if url_p in seen:
                        continue
                    seen.add(url_p)
                    extraidos.append({
                        "titulo": f"{tipo.title()} en {barrio.title()}",
                        "precio": f"USD {precio_usd:,.0f}",
                        "precio_usd": precio_usd, "m2": m2_val,
                        "ambientes": None, "tipo_pub": "inmobiliaria",
                        "rebaja": None, "url": url_p, "addr": barrio.title(),
                        "distancia_km": None, "lat": None, "lng": None,
                        "fuente": "Argenprop",
                    })
                except Exception:
                    continue

        resultados.extend(extraidos)
        time.sleep(0.5)

    print(f"[ACM-AP] {len(resultados)} listings encontrados")
    return resultados


# ── Zonas GBA similares para ampliar búsqueda cuando faltan comparables ────────

# Agrupa barrios GBA por zona socioeconómica similar para búsqueda de respaldo.
# Cuando el barrio principal devuelve pocos comparables del tamaño buscado,
# se agrega automáticamente la zona de respaldo.
_ZONAS_SIMILARES_GBA = {
    # Sur / Sureste
    "wilde":        ["quilmes", "bernal", "lanus"],
    "quilmes":      ["bernal", "wilde", "berazategui"],
    "bernal":       ["quilmes", "wilde", "lanus"],
    "berazategui":  ["quilmes", "bernal", "florencio-varela"],
    # Suroeste
    "lanus":        ["wilde", "lomas-de-zamora", "banfield"],
    "lomas-de-zamora": ["banfield", "temperley", "lanus"],
    "banfield":     ["lomas-de-zamora", "temperley", "lanus"],
    "temperley":    ["lomas-de-zamora", "banfield", "adroguer"],
    # Oeste
    "moron":        ["haedo", "castelar", "ramos-mejia"],
    "haedo":        ["moron", "castelar", "el-palomar"],
    "castelar":     ["moron", "haedo", "ituzaingo"],
    "ramos-mejia":  ["moron", "san-justo", "haedo"],
    # Noroeste
    "san-martin":   ["villa-lynch", "ciudadela", "caseros"],
    "ciudadela":    ["san-martin", "caseros", "villa-lynch"],
    "caseros":      ["ciudadela", "san-martin", "el-palomar"],
    # Norte
    "olivos":       ["florida", "munro", "martinez"],
    "florida":      ["olivos", "munro", "san-isidro"],
    "martinez":     ["san-isidro", "olivos", "beccar"],
    "san-isidro":   ["martinez", "beccar", "florida"],
    "beccar":       ["san-isidro", "martinez", "tigre"],
    # Noreste
    "tigre":        ["san-fernando", "beccar", "san-isidro"],
    "san-fernando": ["tigre", "beccar"],
}

MIN_COMP_CREIBLES = 5   # Mínimo de comparables con m² conocido antes de ampliar


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

    def _run_ri():
        _cb(f"🔎 Consultando **Reporte Inmobiliario** ({barrio.title()})...")
        r = _buscar_ri(barrio, tipo, _crear_session())
        _cb(f"✓ Reporte Inmobiliario: {len(r)} propiedades")
        return r

    todos_zp = todos_ml = todos_ap = todos_ri = []
    _TIMEOUTS = {"ZP": 35, "ML": 35, "AP": 35, "RI": 18}
    _LABELS   = {"ZP": "Zonaprop", "ML": "MercadoLibre", "AP": "Argenprop", "RI": "Reporte Inmobiliario"}
    ex = ThreadPoolExecutor(max_workers=4)
    try:
        fut_zp = ex.submit(_run_zp)
        fut_ml = ex.submit(_run_ml)
        fut_ap = ex.submit(_run_ap)
        fut_ri = ex.submit(_run_ri)
        for fut, name in [(fut_zp, "ZP"), (fut_ml, "ML"), (fut_ap, "AP"), (fut_ri, "RI")]:
            try:
                result = fut.result(timeout=_TIMEOUTS[name])
                if name == "ZP":   todos_zp = result
                elif name == "ML": todos_ml = result
                elif name == "AP": todos_ap = result
                else:              todos_ri = result
            except Exception as e:
                print(f"[ACM-{name}] Timeout o error: {e}")
                _cb(f"⚠️ {_LABELS[name]} no respondió a tiempo")
    finally:
        ex.shutdown(wait=False)  # no bloquear si algún hilo quedó colgado

    # Calcular distancias para comparables de Zonaprop que tienen coordenadas
    if target_lat and target_lng:
        for c in todos_zp:
            if c.get("lat") and c.get("lng"):
                c["distancia_km"] = _distancia_km(target_lat, target_lng, c["lat"], c["lng"])

    # Unificar
    todos = todos_zp + todos_ml + todos_ap + todos_ri

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

    # ── Ampliar a zonas similares si hay pocos comparables creíbles ──────────
    barrio_slug = _slug(barrio)
    zonas_fb    = _ZONAS_SIMILARES_GBA.get(barrio_slug, [])
    comp_con_m2 = [c for c in todos if c.get("m2")]

    if zonas_fb and len(comp_con_m2) < MIN_COMP_CREIBLES:
        _cb(f"🔎 Pocos comparables similares en {barrio.title()} — ampliando búsqueda a zonas cercanas...")
        extras = []
        for barrio_fb in zonas_fb[:2]:   # max 2 barrios adicionales
            _cb(f"   ↳ Buscando en **{barrio_fb.replace('-', ' ').title()}**...")
            ex2 = ThreadPoolExecutor(max_workers=3)
            try:
                f1 = ex2.submit(_buscar_zonaprop, barrio_fb, tipo, _crear_session(), 1)
                f2 = ex2.submit(_buscar_ml, barrio_fb, tipo, m2_target, ambientes_target)
                f3 = ex2.submit(_buscar_argenprop, barrio_fb, tipo, _crear_session(), 1)
                for fut in [f1, f2, f3]:
                    try:
                        extras.extend(fut.result(timeout=30))
                    except Exception:
                        pass
            except Exception as e:
                print(f"[ACM] Fallback {barrio_fb}: {e}")
            finally:
                ex2.shutdown(wait=False)

        if extras:
            # Filtrar por m² también los del barrio de respaldo
            if m2_target:
                margen = max(25, int(m2_target * 0.30))
                extras = [c for c in extras if c["m2"] and abs(c["m2"] - m2_target) <= margen] or extras
            todos = todos + extras
            barrios_extra = ", ".join(b.replace("-", " ").title() for b in zonas_fb[:2])
            _cb(f"✓ Se agregaron {len(extras)} comparables de zonas similares ({barrios_extra})")

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
