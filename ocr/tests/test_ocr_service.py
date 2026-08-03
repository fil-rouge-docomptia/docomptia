import unittest

from app.services.ocr_service import build_field, extract_amount, extract_supplier


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


if __name__ == "__main__":
    unittest.main()
