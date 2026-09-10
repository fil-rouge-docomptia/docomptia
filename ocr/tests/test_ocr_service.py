import unittest

from app.services.ocr_service import (
    build_date_field,
    build_field,
    extract_amount,
    extract_labeled_date,
    extract_supplier,
    extract_total_ttc,
    extract_vat_number,
    normalize_date,
)


class OcrServiceTest(unittest.TestCase):

    def test_build_field_keeps_missing_values_null(self) -> None:
        field = build_field("invoiceNumber", None)

        self.assertEqual("invoiceNumber", field["fieldName"])
        self.assertIsNone(field["rawValue"])
        self.assertIsNone(field["normalizedValue"])
        self.assertIsNone(field["confidenceScore"])

    def test_build_field_does_not_invent_a_confidence_score(self) -> None:
        field = build_field("invoiceNumber", "FAC-2026-001")

        self.assertEqual("FAC-2026-001", field["rawValue"])
        self.assertEqual("FAC-2026-001", field["normalizedValue"])
        self.assertIsNone(field["confidenceScore"])

    def test_extract_amount_does_not_use_an_unlabeled_amount(self) -> None:
        self.assertIsNone(extract_amount("Montant payé : 120,00 EUR", ["TTC"]))

    def test_extract_supplier_does_not_use_an_arbitrary_line(self) -> None:
        raw_text = "FACTURE\nN° de facture : FAC-2026-001\n22/06/2026"

        self.assertIsNone(extract_supplier(raw_text))

    def test_extract_vat_number_does_not_consume_the_next_line(self) -> None:
        raw_text = "N° TVA : FR 40 123 456 789\nFACTURE CLASSIQUE SAS"

        self.assertEqual("FR40123456789", extract_vat_number(raw_text))

    def test_extract_total_ttc_prioritizes_an_explicit_ttc_total(self) -> None:
        raw_text = "Total : 100,00 EUR\nTotal HT : 90,00 EUR\nTotal TTC : 120,00 EUR"

        self.assertEqual("120.00", extract_total_ttc(raw_text))

    def test_extract_total_ttc_does_not_use_an_ht_total(self) -> None:
        self.assertIsNone(extract_total_ttc("Total HT : 100,00 EUR"))

    def test_extract_supplier_accepts_a_receipt_brand(self) -> None:
        raw_text = "CARREFOUR MARKET\nTICKET DE CAISSE\nTotal TTC : 42,50 EUR"

        self.assertEqual("CARREFOUR MARKET", extract_supplier(raw_text))

    def test_extract_supplier_keeps_classic_invoice_legal_names(self) -> None:
        raw_text = "FACTURE\nACME SERVICES SARL\nN° de facture : FAC-2026-001"

        self.assertEqual("ACME SERVICES SARL", extract_supplier(raw_text))

    def test_normalizes_unambiguous_french_numeric_date(self) -> None:
        self.assertEqual("2026-12-31", normalize_date("31/12/2026"))

    def test_normalizes_iso_date(self) -> None:
        self.assertEqual("2026-12-31", normalize_date("2026-12-31"))

    def test_normalizes_unambiguous_us_numeric_date(self) -> None:
        self.assertEqual("2026-12-31", normalize_date("12/31/2026"))

    def test_extracts_and_normalizes_english_month(self) -> None:
        value = extract_labeled_date("Invoice date: June 22, 2026", ["invoice date"])

        self.assertEqual("2026-06-22", value)

    def test_extracts_and_normalizes_french_month(self) -> None:
        value = extract_labeled_date("Date de facture : 22 août 2026", ["date de facture"])

        self.assertEqual("2026-08-22", value)

    def test_keeps_ambiguous_date_raw_and_marks_normalized_value_missing(self) -> None:
        field = build_date_field("Invoice date: 06/07/2026", "invoiceDate", ["invoice date"])

        self.assertEqual("06/07/2026", field["rawValue"])
        self.assertIsNone(field["normalizedValue"])
        self.assertIsNone(field["confidenceScore"])

    def test_keeps_invalid_date_raw_and_marks_normalized_value_missing(self) -> None:
        field = build_date_field("Date de facture : 31/02/2026", "invoiceDate", ["date de facture"])

        self.assertEqual("31/02/2026", field["rawValue"])
        self.assertIsNone(field["normalizedValue"])


if __name__ == "__main__":
    unittest.main()
