import os
import json
import re
import urllib.error
import urllib.request
from decimal import Decimal, InvalidOperation
from io import BytesIO

import pytesseract
from pdf2image import convert_from_bytes
from PIL import Image

AMOUNT_PATTERN = r"(?:\d{1,3}(?:[\s.,]\d{3})+|\d+)"
DECIMAL_AMOUNT_PATTERN = rf"{AMOUNT_PATTERN}[,.]\d{{2}}"
CURRENCY_PATTERN = r"(?:€|EUR)"
EXPECTED_FIELDS = [
    "supplierName",
    "invoiceNumber",
    "invoiceDate",
    "dueDate",
    "commandReference",
    "totalHt",
    "totalTva",
    "totalTtc",
]


def analyze_document(filename: str, content: bytes) -> dict:
    raw_text = extract_text(filename, content)
    regex_values = extract_fields_with_regex(raw_text)
    llm_values = extract_fields_with_llm(raw_text) if is_llm_enabled() else {}

    fields = [build_extracted_field(field_name, regex_values, llm_values) for field_name in EXPECTED_FIELDS]

    return {
        "status": "SUCCESS",
        "rawText": raw_text,
        "confidenceScore": calculate_global_confidence(fields),
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


def build_extracted_field(
    field_name: str,
    regex_values: dict[str, str | None],
    llm_values: dict[str, str | None],
) -> dict[str, str]:
    llm_value = normalize_field_value(field_name, llm_values.get(field_name))
    regex_value = normalize_field_value(field_name, regex_values.get(field_name))
    value = llm_value or regex_value

    if not value:
        confidence = "0.00"
    elif llm_value and regex_value and llm_value == regex_value:
        confidence = "0.90"
    elif llm_value:
        confidence = "0.85"
    else:
        confidence = "0.70"

    return build_field(field_name, value, confidence)


def extract_fields_with_regex(raw_text: str) -> dict[str, str | None]:
    return {
        "supplierName": extract_supplier(raw_text),
        "invoiceNumber": extract_invoice_number(raw_text),
        "invoiceDate": extract_labeled_date(raw_text, ["date de facture", "date d'emission", "date"]),
        "dueDate": extract_labeled_date(raw_text, ["date d'echeance", "date d'échéance", "echeance", "échéance"]),
        "commandReference": extract_command_reference(raw_text),
        "totalHt": extract_amount(raw_text, ["total ht", "HT", "hors taxe"]),
        "totalTva": extract_amount(raw_text, ["TVA", "taxe"], allow_fallback=False),
        "totalTtc": extract_amount(raw_text, ["total ttc", "TTC", "total"]),
    }


def is_llm_enabled() -> bool:
    return os.getenv("OCR_LLM_ENABLED", "false").lower() in {"1", "true", "yes"}


def extract_fields_with_llm(raw_text: str) -> dict[str, str | None]:
    base_url = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434").rstrip("/")
    model = os.getenv("OLLAMA_MODEL", "qwen2.5:7b")
    timeout = float(os.getenv("OLLAMA_TIMEOUT_SECONDS", "45"))

    request = urllib.request.Request(
        f"{base_url}/api/generate",
        data=json.dumps(
            {
                "model": model,
                "prompt": build_llm_prompt(raw_text),
                "stream": False,
                "format": "json",
                "options": {"temperature": 0},
            }
        ).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (OSError, TimeoutError, urllib.error.URLError, json.JSONDecodeError):
        return {}

    try:
        extracted = json.loads(payload.get("response", "{}"))
    except (TypeError, json.JSONDecodeError):
        return {}

    if not isinstance(extracted, dict):
        return {}

    return {
        field_name: normalize_field_value(field_name, extracted.get(field_name))
        for field_name in EXPECTED_FIELDS
    }


def build_llm_prompt(raw_text: str) -> str:
    return f"""
Tu extrais des champs de facture fournisseur francaise depuis un texte OCR bruité.
Retourne uniquement un JSON valide, sans markdown et sans commentaire.
Si une information est absente ou incertaine, retourne null.

Champs attendus:
- supplierName: nom du fournisseur
- invoiceNumber: numero de facture
- invoiceDate: date de facture au format DD/MM/YYYY si possible
- dueDate: date d'echeance au format DD/MM/YYYY si possible
- commandReference: reference de commande
- totalHt: total hors taxes, nombre avec deux decimales et point decimal
- totalTva: montant TVA, nombre avec deux decimales et point decimal
- totalTtc: total TTC, nombre avec deux decimales et point decimal

Texte OCR:
{raw_text}
""".strip()


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


def extract_labeled_date(raw_text: str, labels: list[str]) -> str | None:
    for label in labels:
        pattern = rf"{re.escape(label)}[^\n\r]{{0,40}}?(\d{{1,2}}[/-]\d{{1,2}}[/-]\d{{2,4}})"
        match = re.search(pattern, raw_text, flags=re.IGNORECASE)
        if match:
            return normalize_date(match.group(1))

    return None


def extract_command_reference(raw_text: str) -> str | None:
    patterns = [
        r"(?:commande|reference|référence)[^\n\r]{0,40}?([A-Z]{2,5}[-_/]?\d{4}[-_/]?\d{2,})",
        r"\bCMD[-_/]?\d{4}[-_/]?\d{2,}\b",
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


def normalize_date(value: str) -> str:
    cleaned = value.strip().replace("-", "/")
    parts = cleaned.split("/")
    if len(parts) != 3:
        return cleaned

    day, month, year = parts
    if len(year) == 2:
        year = "20" + year

    return f"{day.zfill(2)}/{month.zfill(2)}/{year}"


def normalize_field_value(field_name: str, value: object) -> str | None:
    if value is None:
        return None

    normalized = str(value).strip()
    if not normalized or normalized.lower() == "null":
        return None

    if field_name in {"totalHt", "totalTva", "totalTtc"}:
        return normalize_amount(normalized)

    if field_name in {"invoiceDate", "dueDate"}:
        return normalize_date(normalized)

    return normalized


def calculate_global_confidence(fields: list[dict[str, str]]) -> str:
    scores = [
        Decimal(field["confidenceScore"])
        for field in fields
        if field.get("normalizedValue")
    ]

    if not scores:
        return "0.00"

    average = sum(scores) / Decimal(len(scores))
    return str(average.quantize(Decimal("0.01")))
