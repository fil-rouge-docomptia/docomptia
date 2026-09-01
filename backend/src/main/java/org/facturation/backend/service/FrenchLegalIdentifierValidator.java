package org.facturation.backend.service;

import org.springframework.stereotype.Service;

import java.util.regex.Pattern;

@Service
public class FrenchLegalIdentifierValidator {

    private static final Pattern SIREN_PATTERN = Pattern.compile("\\d{9}");
    private static final Pattern SIRET_PATTERN = Pattern.compile("\\d{14}");
    private static final Pattern VAT_NUMBER_PATTERN = Pattern.compile("FR[A-Z0-9]{2}\\d{9}");
    private static final Pattern NUMERIC_VAT_KEY_PATTERN = Pattern.compile("\\d{2}");

    public boolean isValidSiren(String siren) {
        return SIREN_PATTERN.matcher(siren).matches()
                && !containsOnlyZeros(siren)
                && hasValidLuhnChecksum(siren);
    }

    public boolean isValidSiret(String siret) {
        return SIRET_PATTERN.matcher(siret).matches()
                && !containsOnlyZeros(siret)
                && hasValidLuhnChecksum(siret);
    }

    public boolean isValidVatNumber(String vatNumber) {
        if (!VAT_NUMBER_PATTERN.matcher(vatNumber).matches()) {
            return false;
        }

        String siren = extractSirenFromVatNumber(vatNumber);
        if (containsOnlyZeros(siren) || !hasValidLuhnChecksum(siren)) {
            return false;
        }

        String key = vatNumber.substring(2, 4);
        return !NUMERIC_VAT_KEY_PATTERN.matcher(key).matches()
                || Integer.parseInt(key) == calculateNumericVatKey(siren);
    }

    public boolean referToSameCompany(String siret, String vatNumber) {
        return siret.substring(0, 9).equals(extractSirenFromVatNumber(vatNumber));
    }

    private String extractSirenFromVatNumber(String vatNumber) {
        return vatNumber.substring(4);
    }

    private int calculateNumericVatKey(String siren) {
        long sirenValue = Long.parseLong(siren);
        return (int) ((12 + 3 * (sirenValue % 97)) % 97);
    }

    private boolean hasValidLuhnChecksum(String identifier) {
        int sum = 0;
        boolean doubleDigit = false;
        for (int index = identifier.length() - 1; index >= 0; index--) {
            int digit = identifier.charAt(index) - '0';
            if (doubleDigit) {
                digit *= 2;
                if (digit > 9) {
                    digit -= 9;
                }
            }
            sum += digit;
            doubleDigit = !doubleDigit;
        }
        return sum % 10 == 0;
    }

    private boolean containsOnlyZeros(String value) {
        return value.chars().allMatch(character -> character == '0');
    }
}
