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
        build_field("siret", extract_siret(raw_text), "0.75"),
        build_field("vatNumber", extract_vat_number(raw_text), "0.75"),
        build_field("invoiceNumber", extract_invoice_number(raw_text), "0.75"),
        build_field("invoiceDate", extract_labeled_date(raw_text, ["date de facture", "date d'emission", "date d'émission"]), "0.70"),
        build_field("dueDate", extract_labeled_date(raw_text, ["date d'echeance", "date d'échéance", "echeance", "échéance"]), "0.70"),
        build_field("commandReference", extract_command_reference(raw_text), "0.70"),
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
    for line in lines[:15]:
        candidate = clean_supplier_candidate(line)
        if candidate and looks_like_supplier_name(candidate):
            return candidate

    for line in lines[:15]:
        candidate = clean_supplier_candidate(line)
        if candidate:
            return candidate

    return None


def clean_supplier_candidate(line: str) -> str | None:
    if line.strip().lower() in {"facture", "invoice", "avoir", "devis"}:
        return None

    candidate = re.split(
        r"(?:n[°o]?\s*de\s*facture|date\s+de\s+facture|date\s+d['’]échéance|date\s+d['’]echeance|commande|siret|tva)",
        line,
        flags=re.IGNORECASE,
    )[0].strip(" :-")
    return candidate or None


def looks_like_supplier_name(value: str) -> bool:
    return bool(re.search(r"\b(?:SA|SAS|SARL|EURL|SNC|SCA|ASSOCIATION)\b", value, flags=re.IGNORECASE))


def extract_invoice_number(raw_text: str) -> str | None:
    patterns = [
        r"(?:n[°o.]?\s*de\s*facture|numero\s*de\s*facture|numéro\s*de\s*facture|invoice\s*(?:number|no.?))[ \t]*[:#-]?[ \t]*([A-Z0-9][A-Z0-9._/-]{2,})",
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


def extract_siret(raw_text: str) -> str | None:
    match = re.search(r"\bSIRET[ \t:]*([0-9][0-9\s]{13,})", raw_text, flags=re.IGNORECASE)
    if not match:
        return None

    digits = re.sub(r"\D", "", match.group(1))
    return digits[:14] if len(digits) >= 14 else None


def extract_vat_number(raw_text: str) -> str | None:
    match = re.search(
        r"(?:TVA\s+intracommunautaire|N[°o.]?\s*TVA|VAT)[^\n\r:]*:?[ \t]*([A-Z]{2}[A-Z0-9\s]{8,})",
        raw_text,
        flags=re.IGNORECASE,
    )
    if not match:
        return None

    return re.sub(r"\s", "", match.group(1)).upper()


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
