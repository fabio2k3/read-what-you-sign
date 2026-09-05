# main.py
# Backend mínimo: por ahora usa las MISMAS reglas que el content_script.js,
# solo para validar que la extensión y el servidor se puedan comunicar.
# En la próxima fase reemplazamos esta lógica por un modelo BERT fine-tuned.

import re

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Read What You Sign - API")

# CORS: por defecto, un navegador bloquea que una extensión (o cualquier
# origen) le hable a un servidor distinto. Como nuestra extensión corre
# en un origen "chrome-extension://...", necesitamos habilitarlo explícitamente.
# Para desarrollo local dejamos "*" (cualquier origen); antes de publicar
# esto hay que restringirlo al ID real de la extensión.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

RISK_PHRASES = [
    {"pattern": r"compartir(\s\w+){0,3}\sterceros", "label": "Tus datos pueden pasar a otras empresas."},
    {"pattern": r"datos\sbiométricos", "label": "Piden datos de tu cuerpo (huellas, cara, voz)."},
    {"pattern": r"venta\sde\sdatos", "label": "Pueden vender tu información."},
    {"pattern": r"ubicación\sen\stiempo\sreal", "label": "Saben dónde estás en cada momento."},
    {"pattern": r"perpetuidad", "label": "Se quedan con el permiso para siempre, sin fecha de vencimiento."},
    {"pattern": r"sin\sposibilidad\sde\seliminación", "label": "No podés borrar tus datos después."},
    {"pattern": r"reconocimiento\sfacial", "label": "Analizan tu cara para identificarte."},
    {"pattern": r"grabación\sde\svoz", "label": "Guardan grabaciones de tu voz."},
]


class AnalyzeRequest(BaseModel):
    text: str


class RiskMatch(BaseModel):
    phrase: str
    label: str


class AnalyzeResponse(BaseModel):
    count: int
    matches: list[RiskMatch]


@app.get("/health")
def health_check():
    """Endpoint simple para confirmar que el servidor está corriendo."""
    return {"status": "ok"}


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(request: AnalyzeRequest):
    matches: list[RiskMatch] = []

    for rule in RISK_PHRASES:
        for found in re.finditer(rule["pattern"], request.text, flags=re.IGNORECASE):
            matches.append(RiskMatch(phrase=found.group(0), label=rule["label"]))

    return AnalyzeResponse(count=len(matches), matches=matches)
