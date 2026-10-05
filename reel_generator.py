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

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
W, H = 1080, 1920
FONT_BOLD = os.path.join(os.path.dirname(__file__), "static", "fonts", "DejaVuSans-Bold.ttf")


def _escapar_drawtext(texto: str) -> str:
    """Escapa los caracteres que el parser de filtros de ffmpeg interpreta
    especial dentro de un valor de drawtext (: ' % \\)."""
    texto = texto.replace("\\", "\\\\")
    texto = texto.replace(":", "\\:")
    texto = texto.replace("%", "\\%")
    texto = texto.replace("'", "’")  # comilla simple tipográfica, evita romper el filtro
    return texto


def _font_path_ffmpeg(path: str) -> str:
    """ffmpeg en Windows necesita el ':' de la unidad (C:) escapado dentro
    del filtro; en Linux no hay ':' en la ruta así que no afecta."""
    return path.replace("\\", "/").replace(":", "\\:")


def _duracion_por_foto(n_fotos: int) -> float:
    objetivo_total = 15.0
    dur = objetivo_total / max(n_fotos, 1)
    return max(1.8, min(dur, 4.5))


def _run(cmd):
    r = subprocess.run(cmd, capture_output=True)
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

        precio = _escapar_drawtext(datos.get("precio") or "Consultar precio")
        specs = _escapar_drawtext(datos.get("specs") or "")
        pie = _escapar_drawtext(datos.get("agente_nombre") and f"Preparado por {datos['agente_nombre']} · MT90 Tracción" or "MT90 Tracción")
        font = _font_path_ffmpeg(FONT_BOLD)

        capas = [f"drawbox=x=0:y=ih-300:w=iw:h=300:color=black@0.48:t=fill"]
        capas.append(f"drawtext=fontfile='{font}':text='{precio}':fontcolor=white:fontsize=70:x=(w-text_w)/2:y=h-250")
        if specs:
            capas.append(f"drawtext=fontfile='{font}':text='{specs}':fontcolor=white:fontsize=38:x=(w-text_w)/2:y=h-155")
        capas.append(f"drawtext=fontfile='{font}':text='{pie}':fontcolor=white@0.85:fontsize=26:x=(w-text_w)/2:y=h-75")

        final_path = os.path.join(tmp, "final.mp4")
        _run([
            FFMPEG, "-y", "-i", concat_path, "-vf", ",".join(capas),
            "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", final_path,
        ])

        with open(final_path, "rb") as f:
            return f.read()
