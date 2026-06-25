from fastapi import FastAPI, File, UploadFile

from app.services.ocr_service import analyze_document

app = FastAPI(title="Facturation OCR API")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "UP"}


@app.post("/ocr/analyze")
async def analyze(file: UploadFile = File(...)) -> dict:
    content = await file.read()
    return analyze_document(file.filename or "invoice-file", content)
