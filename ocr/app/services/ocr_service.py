import os
import re
import unicodedata
from datetime import date
from decimal import Decimal, InvalidOperation
from io import BytesIO

import pytesseract
from pdf2image import convert_from_bytes
from PIL import Image

AMOUNT_PATTERN = r"(?:\d{1,3}(?:[\s.,]\d{3})+|\d+)"
DECIMAL_AMOUNT_PATTERN = rf"{AMOUNT_PATTERN}[,.]\d{{2}}"
CURRENCY_PATTERN = r"(?:€|EUR)"
OCR_ENGINE_NAME = "tesseract"
DATE_LABEL_SEPARATOR_PATTERN = r"[ \t]*(?::|[-–])?[ \t]*"
MONTH_NAMES = {
    "jan": 1, "january": 1, "janvier": 1,
    "feb": 2, "february": 2, "fev": 2, "fevrier": 2,
    "mar": 3, "march": 3, "mars": 3,
    "apr": 4, "april": 4, "avr": 4, "avril": 4,
    "may": 5, "mai": 5,
    "jun": 6, "june": 6, "juin": 6,
    "jul": 7, "july": 7, "juil": 7, "juillet": 7,
    "aug": 8, "august": 8, "aou": 8, "aout": 8,
    "sep": 9, "sept": 9, "september": 9, "septembre": 9,
    "oct": 10, "october": 10, "octobre": 10,
    "nov": 11, "november": 11, "novembre": 11,
    "dec": 12, "december": 12, "decembre": 12,
}
MONTH_NAME_PATTERN = "|".join(sorted(MONTH_NAMES, key=len, reverse=True))
DATE_CANDIDATE_PATTERN = re.compile(
    rf"(?:\d{{4}}[-/]\d{{1,2}}[-/]\d{{1,2}}"
    rf"|\d{{1,2}}[-/]\d{{1,2}}[-/](?:\d{{4}}|\d{{2}})"
    rf"|\d{{1,2}}[ \t]+(?:{MONTH_NAME_PATTERN})\.?[ \t]+(?:\d{{4}}|\d{{2}})"
    rf"|(?:{MONTH_NAME_PATTERN})\.?[ \t]+\d{{1,2}}(?:st|nd|rd|th)?(?:,)?[ \t]+(?:\d{{4}}|\d{{2}}))",
    flags=re.IGNORECASE,
)


def analyze_document(filename: str, content: bytes) -> dict:
    raw_text = extract_text(filename, content)

    fields = [
        build_field("supplierName", extract_supplier(raw_text)),
        build_field("siret", extract_siret(raw_text)),
        build_field("vatNumber", extract_vat_number(raw_text)),
        build_field("invoiceNumber", extract_invoice_number(raw_text)),
        build_date_field(raw_text, "invoiceDate", [
            "date de facture", "date d'emission", "date d'émission", "invoice date", "issue date",
        ]),
        build_date_field(raw_text, "dueDate", [
            "date d'echeance", "date d'échéance", "echeance", "échéance", "due date", "payment due",
        ]),
        build_field("commandReference", extract_command_reference(raw_text)),
        build_field("totalHt", extract_amount(raw_text, ["HT", "hors taxe"])),
        build_field("totalTva", extract_amount(raw_text, ["TVA", "taxe"])),
        build_field("totalTtc", extract_amount(raw_text, ["TTC", "total"])),
    ]

    return {
        "status": "SUCCESS",
        "engineName": OCR_ENGINE_NAME,
        "engineVersion": str(pytesseract.get_tesseract_version()),
        "rawText": raw_text,
        "confidenceScore": None,
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


def build_field(field_name: str, value: str | None) -> dict[str, str | None]:
    return {
        "fieldName": field_name,
        "rawValue": value,
        "normalizedValue": value,
        "confidenceScore": None,
    }


def build_date_field(raw_text: str, field_name: str, labels: list[str]) -> dict[str, str | None]:
    raw_value = find_labeled_date(raw_text, labels)
    return {
        "fieldName": field_name,
        "rawValue": raw_value,
        "normalizedValue": normalize_date(raw_value) if raw_value else None,
        "confidenceScore": None,
    }


def extract_supplier(raw_text: str) -> str | None:
    lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
    for line in lines[:15]:
        candidate = clean_supplier_candidate(line)
        if candidate and looks_like_supplier_name(candidate):
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
    raw_value = find_labeled_date(raw_text, labels)
    return normalize_date(raw_value) if raw_value else None


def find_labeled_date(raw_text: str, labels: list[str]) -> str | None:
    for label in labels:
        pattern = rf"{re.escape(label)}{DATE_LABEL_SEPARATOR_PATTERN}([^\n\r]{{0,40}})"
        match = re.search(pattern, raw_text, flags=re.IGNORECASE)
        if match:
            text_after_label = match.group(1)
            date_match = DATE_CANDIDATE_PATTERN.search(normalize_accents(text_after_label))
            if date_match:
                return text_after_label[date_match.start():date_match.end()]

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


def extract_amount(raw_text: str, labels: list[str]) -> str | None:
    for label in labels:
        pattern = (
            rf"{re.escape(label)}[^\n\r]{{0,40}}?"
            rf"(?:({DECIMAL_AMOUNT_PATTERN})\s*(?:{CURRENCY_PATTERN})?"
            rf"|({AMOUNT_PATTERN})\s*{CURRENCY_PATTERN})"
        )
        match = re.search(pattern, raw_text, flags=re.IGNORECASE)
        if match:
            return normalize_amount(match.group(1) or match.group(2))

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


def normalize_date(value: str) -> str | None:
    cleaned = normalize_accents(value).strip().lower()
    iso_match = re.fullmatch(r"(\d{4})[-/](\d{1,2})[-/](\d{1,2})", cleaned)
    if iso_match:
        return format_valid_date(int(iso_match.group(1)), int(iso_match.group(2)), int(iso_match.group(3)))

    numeric_match = re.fullmatch(r"(\d{1,2})[-/](\d{1,2})[-/](\d{2}|\d{4})", cleaned)
    if numeric_match:
        first, second, year = (int(part) for part in numeric_match.groups())
        year = normalize_year(year)
        if first > 12 and second <= 12:
            return format_valid_date(year, second, first)
        if second > 12 and first <= 12:
            return format_valid_date(year, first, second)
        if first == second and first <= 12:
            return format_valid_date(year, second, first)
        return None

    day_first_match = re.fullmatch(
        rf"(\d{{1,2}})[ \t]+({MONTH_NAME_PATTERN})\.?[ \t]+(\d{{2}}|\d{{4}})",
        cleaned,
    )
    if day_first_match:
        return format_textual_date(day_first_match.group(3), day_first_match.group(2), day_first_match.group(1))

    month_first_match = re.fullmatch(
        rf"({MONTH_NAME_PATTERN})\.?[ \t]+(\d{{1,2}})(?:st|nd|rd|th)?(?:,)?[ \t]+(\d{{2}}|\d{{4}})",
        cleaned,
    )
    if month_first_match:
        return format_textual_date(month_first_match.group(3), month_first_match.group(1), month_first_match.group(2))

    return None


def normalize_accents(value: str) -> str:
    return "".join(character for character in unicodedata.normalize("NFD", value) if unicodedata.category(character) != "Mn")


def normalize_year(year: int) -> int:
    return 2000 + year if year < 100 else year


def format_textual_date(year: str, month_name: str, day: str) -> str | None:
    return format_valid_date(normalize_year(int(year)), MONTH_NAMES[month_name.rstrip(".")], int(day))


def format_valid_date(year: int, month: int, day: int) -> str | None:
    try:
        return date(year, month, day).isoformat()
    except ValueError:
        return None
