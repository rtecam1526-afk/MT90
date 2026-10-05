"""
MT90 Tracción — Generador de Reels
Arma un video vertical (1080x1920, formato Reels/TikTok/Stories) a partir de
fotos de una propiedad + datos (precio, m², ambientes, barrio), con efecto
Ken Burns (zoom lento) por foto y precio/specs superpuestos.

Decisiones de diseño, por qué:
- ffmpeg directo (zoompan + drawtext), NO moviepy con resize por frame en
  Python: un smoke test con moviepy tardó 100s para un clip de 6s porque
  recalcula el resize en Python frame a frame. El mismo resultado vía
  filtros nativos de ffmpeg tarda ~1-4s por segmento — la diferencia entre
  "funciona para probar" y "el agente puede esperarlo en el momento".
- Sin audio: así no hay riesgo de derechos de autor por música de fondo.
  Instagram/TikTok dejan agregar música propia al subir — es mejor que el
  agente la elija ahí que nosotros le metamos una pista fija.
- Tipografía DejaVu Sans Bold (licencia libre, viene en el repo en
  static/fonts/) en vez de una fuente del sistema operativo — así se ve
  igual en Windows (desarrollo) y Linux (Render), y no dependemos de
  fuentes de Microsoft que no se pueden redistribuir.
"""
import os
import re
import subprocess
import tempfile
import uuid

import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFont

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
W, H = 1080, 1920
FONT_BOLD = os.path.join(os.path.dirname(__file__), "static", "fonts", "DejaVuSans-Bold.ttf")


def _crear_overlay_png(path: str, precio: str, specs: str, pie: str):
    """Dibuja el precio/specs/firma con Pillow sobre un PNG transparente, que
    después ffmpeg superpone con el filtro 'overlay'. NO usamos drawtext de
    ffmpeg: el binario que trae imageio-ffmpeg para Linux (Render) es un build
    liviano sin libfreetype — drawtext tira 'No such filter' ahí, aunque en
    Windows (donde se prueba en desarrollo) sí está. overlay es un filtro
    básico que no depende de freetype, así que es portable entre ambos."""
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    banda_h = 320
    for y in range(banda_h):
        alpha = int(235 * (y / banda_h))
        draw.line([(0, H - banda_h + y), (W, H - banda_h + y)], fill=(10, 10, 10, alpha))
    draw.rectangle([0, H - 40, W, H], fill=(10, 10, 10, 235))

    f_precio = ImageFont.truetype(FONT_BOLD, 76)
    f_specs = ImageFont.truetype(FONT_BOLD, 40)
    f_pie = ImageFont.truetype(FONT_BOLD, 28)

    def centrado(texto, font, y):
        bbox = draw.textbbox((0, 0), texto, font=font)
        x = (W - (bbox[2] - bbox[0])) / 2 - bbox[0]
        draw.text((x, y), texto, font=font, fill=(255, 255, 255, 255))

    centrado(precio, f_precio, H - 270)
    if specs:
        centrado(specs, f_specs, H - 175)
    centrado(pie, f_pie, H - 95)

    img.save(path, "PNG")


def _duracion_por_foto(n_fotos: int) -> float:
    objetivo_total = 15.0
    dur = objetivo_total / max(n_fotos, 1)
    return max(1.8, min(dur, 4.5))


def _run(cmd, timeout=60):
    # timeout explícito: sin esto, un ffmpeg colgado (CPU débil en el server,
    # foto corrupta, lo que sea) se comía el límite general del proceso (120s)
    # y moría TODO el worker de golpe — sin pasar por ningún except nuestro,
    # el agente veía la página cruda de error de Flask en vez de un mensaje
    # claro. Con timeout acá, un cuelgue se convierte en un error controlado.
    try:
        r = subprocess.run(cmd, capture_output=True, timeout=timeout)
    except subprocess.TimeoutExpired:
        raise RuntimeError("ffmpeg tardó demasiado (posible foto muy pesada o server lento) — probá con menos fotos.")
    except OSError as e:
        raise RuntimeError(f"No se pudo ejecutar ffmpeg: {e}")
    if r.returncode != 0:
        raise RuntimeError(f"ffmpeg falló: {r.stderr.decode('utf-8', 'ignore')[-800:]}")


def _segmento(foto_path: str, out_path: str, dur: float, zoom_in: bool):
    z_expr = "min(zoom+0.0018,1.22)" if zoom_in else "max(1.22-0.0018*on,1.0)"
    vf = (
        f"scale=2400:-1,"
        f"zoompan=z='{z_expr}':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={W}x{H}:fps=25,"
        f"trim=duration={dur},setpts=PTS-STARTPTS"
    )
    _run([
        FFMPEG, "-y", "-loop", "1", "-i", foto_path, "-vf", vf,
        "-c:v", "libx264", "-preset", "veryfast", "-t", str(dur), "-pix_fmt", "yuv420p", out_path,
    ])


def generar_reel(fotos_bytes: list, datos: dict) -> bytes:
    """fotos_bytes: lista de bytes de imagen (JPEG/PNG), en el orden a mostrar.
    datos: {precio, specs (ej "3 amb · 65 m² · Palermo"), agente_nombre}.
    Devuelve los bytes del mp4 final. Lanza RuntimeError si algo de ffmpeg falla
    — el caller decide qué mostrarle al agente (acá no hay fallback silencioso,
    un reel a medias es peor que un error claro de "probá de nuevo")."""
    if not fotos_bytes:
        raise ValueError("Necesito al menos una foto")

    with tempfile.TemporaryDirectory(prefix="mt90_reel_") as tmp:
        dur = _duracion_por_foto(len(fotos_bytes))
        segmentos = []
        for i, data in enumerate(fotos_bytes):
            foto_path = os.path.join(tmp, f"foto{i}.jpg")
            with open(foto_path, "wb") as f:
                f.write(data)
            seg_path = os.path.join(tmp, f"seg{i}.mp4")
            _segmento(foto_path, seg_path, dur, zoom_in=(i % 2 == 0))
            segmentos.append(seg_path)

        lista_path = os.path.join(tmp, "lista.txt")
        with open(lista_path, "w", encoding="utf-8") as f:
            for s in segmentos:
                ruta = s.replace("\\", "/").replace("'", "'\\''")
                f.write(f"file '{ruta}'\n")

        concat_path = os.path.join(tmp, "concat.mp4")
        _run([FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", lista_path, "-c", "copy", concat_path])

        precio = datos.get("precio") or "Consultar precio"
        specs = datos.get("specs") or ""
        pie = f"Preparado por {datos['agente_nombre']} · MT90 Tracción" if datos.get("agente_nombre") else "MT90 Tracción"

        overlay_path = os.path.join(tmp, "overlay.png")
        _crear_overlay_png(overlay_path, precio, specs, pie)

        final_path = os.path.join(tmp, "final.mp4")
        _run([
            FFMPEG, "-y", "-i", concat_path, "-i", overlay_path,
            "-filter_complex", "[0:v][1:v]overlay=0:0:format=auto",
            "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", final_path,
        ])

        with open(final_path, "rb") as f:
            return f.read()
