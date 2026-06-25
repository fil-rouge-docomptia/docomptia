import os
import re
from decimal import Decimal, InvalidOperation
from io import BytesIO

import pytesseract
from pdf2image import convert_from_bytes
from PIL import Image

AMOUNT_PATTERN = r"(?:\d{1,3}(?:[\s.,]\d{3})+|\d+)"
DECIMAL_AMOUNT_PATTERN = rf"{AMOUNT_PATTERN}[,.]\d{{2}}"
CURRENCY_PATTERN = r"(?:€|EUR)"


def analyze_document(filename: str, content: bytes) -> dict:
    raw_text = extract_text(filename, content)

    fields = [
        build_field("supplierName", extract_supplier(raw_text), "0.70"),
        build_field("invoiceNumber", extract_invoice_number(raw_text), "0.75"),
        build_field("totalHt", extract_amount(raw_text, ["HT", "hors taxe"]), "0.70"),
        build_field("totalTva", extract_amount(raw_text, ["TVA", "taxe"], allow_fallback=False), "0.70"),
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


def extract_amount(raw_text: str, labels: list[str], allow_fallback: bool = True) -> str | None:
    for label in labels:
        pattern = (
            rf"{re.escape(label)}[^\n\r]{{0,40}}?"
            rf"(?:({DECIMAL_AMOUNT_PATTERN})\s*(?:{CURRENCY_PATTERN})?"
            rf"|({AMOUNT_PATTERN})\s*{CURRENCY_PATTERN})"
        )
        match = re.search(pattern, raw_text, flags=re.IGNORECASE)
        if match:
            return normalize_amount(match.group(1) or match.group(2))

    if not allow_fallback:
        return None

    amounts = re.findall(DECIMAL_AMOUNT_PATTERN, raw_text)
    if amounts:
        return normalize_amount(amounts[-1])

    return None


def normalize_amount(value: str) -> str:
    cleaned = value.replace(" ", "").replace("\u00a0", "")
    if "," in cleaned and "." in cleaned:
        decimal_separator = "," if cleaned.rfind(",") > cleaned.rfind(".") else "."
        thousands_separator = "." if decimal_separator == "," else ","
        cleaned = cleaned.replace(thousands_separator, "")
        cleaned = cleaned.replace(decimal_separator, ".")
    else:
        cleaned = cleaned.replace(",", ".")

    try:
        return str(Decimal(cleaned).quantize(Decimal("0.01")))
    except InvalidOperation:
        return cleaned
