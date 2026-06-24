import os
import re
from decimal import Decimal, InvalidOperation
from io import BytesIO

import pytesseract
from pdf2image import convert_from_bytes
from PIL import Image


def analyze_document(filename: str, content: bytes) -> dict:
    raw_text = extract_text(filename, content)

    fields = [
        build_field("supplierName", extract_supplier(raw_text), "0.70"),
        build_field("invoiceNumber", extract_invoice_number(raw_text), "0.75"),
        build_field("totalHt", extract_amount(raw_text, ["HT", "hors taxe"]), "0.70"),
        build_field("totalTva", extract_amount(raw_text, ["TVA", "taxe"]), "0.70"),
        build_field("totalTtc", extract_amount(raw_text, ["TTC", "total"]), "0.75"),
    ]

    return {
        "status": "SUCCESS",
        "rawText": raw_text,
        "confidenceScore": "0.75",
        "fields": fields,
    }


def extract_text(filename: str, content: bytes) -> str:
    languages = os.getenv("OCR_LANGUAGES", "fra+eng")
    images = load_images(filename, content)
    texts = [pytesseract.image_to_string(image, lang=languages) for image in images]
    return "\n".join(text.strip() for text in texts if text.strip())


def load_images(filename: str, content: bytes) -> list[Image.Image]:
    if filename.lower().endswith(".pdf"):
        return convert_from_bytes(content, dpi=300)

    image = Image.open(BytesIO(content))
    return [image.convert("RGB")]


def build_field(field_name: str, value: str | None, confidence: str) -> dict[str, str]:
    normalized_value = value or ""
    return {
        "fieldName": field_name,
        "rawValue": normalized_value,
        "normalizedValue": normalized_value,
        "confidenceScore": confidence if normalized_value else "0.00",
    }


def extract_supplier(raw_text: str) -> str | None:
    lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
    return lines[0] if lines else None


def extract_invoice_number(raw_text: str) -> str | None:
    patterns = [
        r"(?:facture|invoice)\s*(?:n[°o.]?|number)?\s*[:#-]?\s*([A-Z0-9][A-Z0-9._/-]{2,})",
        r"\b(?:INV|FAC)[-_]?[0-9][A-Z0-9._/-]*\b",
    ]

    for pattern in patterns:
        match = re.search(pattern, raw_text, flags=re.IGNORECASE)
        if match:
            return match.group(1) if match.groups() else match.group(0)

    return None


def extract_amount(raw_text: str, labels: list[str]) -> str | None:
    for label in labels:
        pattern = rf"{re.escape(label)}[^\d]{{0,20}}([0-9\s]+(?:[,.][0-9]{{2}})?)"
        match = re.search(pattern, raw_text, flags=re.IGNORECASE)
        if match:
            return normalize_amount(match.group(1))

    amounts = re.findall(r"([0-9\s]+[,.][0-9]{2})", raw_text)
    if amounts:
        return normalize_amount(amounts[-1])

    return None


def normalize_amount(value: str) -> str:
    cleaned = value.replace(" ", "").replace(",", ".")
    try:
        return str(Decimal(cleaned).quantize(Decimal("0.01")))
    except InvalidOperation:
        return cleaned
