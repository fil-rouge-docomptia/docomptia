package org.facturation.backend.service.ocr;

import org.facturation.backend.dto.response.OcrFieldResponse;
import org.springframework.stereotype.Service;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class InvoiceOcrFieldExtractor {

    private static final Pattern INVOICE_NUMBER_PATTERN = Pattern.compile(
            "(?i)(?:facture|invoice|numero|num|reference|ref)[^A-Z0-9]{0,10}([A-Z0-9][A-Z0-9\\-/]{2,})"
    );
    private static final Pattern DATE_PATTERN = Pattern.compile("\\b(\\d{2}[/-]\\d{2}[/-]\\d{4}|\\d{4}-\\d{2}-\\d{2})\\b");
    private static final Pattern AMOUNT_PATTERN = Pattern.compile("(\\d+[\\d .,]*\\d)");

    public List<OcrFieldResponse> extract(String rawText) {
        List<OcrFieldResponse> fields = new ArrayList<>();

        extractSupplierName(rawText).ifPresent(value -> fields.add(createField("supplierName", value, value)));
        extractInvoiceNumber(rawText).ifPresent(value -> fields.add(createField("invoiceNumber", value, value)));
        extractInvoiceDate(rawText).ifPresent(value -> fields.add(createField("invoiceDate", value, normalizeDate(value))));
        extractAmountByKeyword(rawText, "ht").ifPresent(value -> fields.add(createField("totalHt", value, normalizeAmount(value))));
        extractAmountByKeyword(rawText, "tva").ifPresent(value -> fields.add(createField("totalTva", value, normalizeAmount(value))));
        extractAmountByKeyword(rawText, "ttc").ifPresent(value -> fields.add(createField("totalTtc", value, normalizeAmount(value))));

        return fields;
    }

    private Optional<String> extractSupplierName(String rawText) {
        return rawText.lines()
                .map(String::trim)
                .filter(line -> !line.isBlank())
                .filter(line -> line.length() > 2)
                .filter(line -> !containsAny(normalize(line), "facture", "invoice", "date", "numero", "reference", "tva", "ttc", "ht"))
                .findFirst();
    }

    private Optional<String> extractInvoiceNumber(String rawText) {
        return findFirstGroup(INVOICE_NUMBER_PATTERN, rawText);
    }

    private Optional<String> extractInvoiceDate(String rawText) {
        return findFirstGroup(DATE_PATTERN, rawText);
    }

    private Optional<String> extractAmountByKeyword(String rawText, String keyword) {
        return rawText.lines()
                .map(String::trim)
                .filter(line -> containsAny(normalize(line), keyword))
                .map(this::extractLastAmountFromLine)
                .filter(Optional::isPresent)
                .map(Optional::get)
                .findFirst();
    }

    private Optional<String> extractLastAmountFromLine(String line) {
        Matcher matcher = AMOUNT_PATTERN.matcher(line);
        String lastMatch = null;
        while (matcher.find()) {
            lastMatch = matcher.group(1);
        }
        return Optional.ofNullable(lastMatch);
    }

    private Optional<String> findFirstGroup(Pattern pattern, String rawText) {
        Matcher matcher = pattern.matcher(rawText);
        if (matcher.find()) {
            return Optional.ofNullable(matcher.group(1));
        }
        return Optional.empty();
    }

    private OcrFieldResponse createField(String fieldName, String rawValue, String normalizedValue) {
        OcrFieldResponse field = new OcrFieldResponse();
        field.setFieldName(fieldName);
        field.setRawValue(rawValue);
        field.setNormalizedValue(normalizedValue);
        return field;
    }

    private String normalizeDate(String value) {
        if (value.matches("\\d{4}-\\d{2}-\\d{2}")) {
            return value;
        }

        String[] parts = value.split("[/-]");
        if (parts.length == 3) {
            return parts[2] + "-" + parts[1] + "-" + parts[0];
        }

        return value;
    }

    private String normalizeAmount(String value) {
        String sanitized = value.replace(" ", "").replace(",", ".");
        int lastDotIndex = sanitized.lastIndexOf('.');
        if (lastDotIndex > 0) {
            sanitized = sanitized.substring(0, lastDotIndex).replace(".", "") + sanitized.substring(lastDotIndex);
        }
        return sanitized;
    }

    private String normalize(String value) {
        return Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT);
    }

    private boolean containsAny(String value, String... keywords) {
        for (String keyword : keywords) {
            if (value.contains(keyword)) {
                return true;
            }
        }
        return false;
    }
}
