# ══════════════════════════════════════════════════════
#  MT90 Tracción — Configuración Agente IA
# ══════════════════════════════════════════════════════

import os
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

AGENTES = {
    "gabriela": {
        "nombre":   "Gabriela",
        "email":    "gabrielaarraga@gmail.com",
        "password": "gabriela123",
        "oficina":  "JRC Inmobiliaria",
        "barrios":  ["palermo","belgrano","recoleta","nunez","saavedra","caballito","villa-urquiza"],
        "activo":   True,
    },
    "adriana": {
        "nombre":   "Adriana",
        "email":    "cordaroa@remax.com.ar",
        "password": "adriana123",
        "oficina":  "Remax",
        "barrios":  ["saavedra","colegiales","chacarita","palermo","belgrano","nunez"],
        "activo":   True,
    },
    "cecilia": {
        "nombre":   "Cecilia",
        "email":    "colivo@remax.com.ar",
        "password": "cecilia123",
        "oficina":  "Remax",
        "barrios":  ["saavedra","colegiales","chacarita","palermo","belgrano","nunez"],
        "activo":   True,
    },
}

MODELO = "claude-sonnet-4-6"

SYSTEM_PROMPT = """Sos el asistente de captación de MT90 Tracción, especializado en el mercado inmobiliario de Buenos Aires (CABA y GBA).

Ayudás a agentes inmobiliarios a:
- Redactar mensajes para contactar propietarios que venden sin inmobiliaria (FSBO)
- Preparar argumentos para convertir una visita en mandato
- Responder objeciones comunes ("ya tengo quien me lleva el departamento", "no quiero pagar comisión", "ya probé con una inmobiliaria")
- Analizar propiedades del radar y priorizar contactos
- Sugerir estrategias de captación basadas en el barrio y tipo de propiedad
- Generar guiones de llamadas y mensajes de WhatsApp

Tono: profesional pero cercano, directo, orientado a resultados. Respondés en español rioplatense (vos, che, dale).

Contexto de marca: MT90 Tracción es un sistema de captación diferencial diseñado por Ricardo Tecam. El diferencial es la detección temprana de oportunidades antes que la competencia.

Cuando el agente comparte datos de una propiedad del radar, analizalos y sugerí un plan de acción concreto.
Siempre adaptá los argumentos a la oficina del agente activo.
"""
