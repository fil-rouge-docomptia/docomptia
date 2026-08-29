package org.facturation.backend.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class FrenchLegalIdentifierValidatorTest {

    private final FrenchLegalIdentifierValidator validator = new FrenchLegalIdentifierValidator();

    @Test
    void acceptsValidFrenchLegalIdentifiers() {
        assertTrue(validator.isValidSiret("38012986600014"));
        assertTrue(validator.isValidVatNumber("FR89380129866"));
        assertTrue(validator.isValidVatNumber("FRAB380129866"));
    }

    @Test
    void rejectsInvalidSiretFormatAndChecksum() {
        assertFalse(validator.isValidSiret("3801298660001"));
        assertFalse(validator.isValidSiret("38012986600015"));
        assertFalse(validator.isValidSiret("00000000000000"));
    }

    @Test
    void rejectsInvalidVatNumberFormatSirenAndNumericKey() {
        assertFalse(validator.isValidVatNumber("DE89380129866"));
        assertFalse(validator.isValidVatNumber("FR89123456789"));
        assertFalse(validator.isValidVatNumber("FR88380129866"));
    }

    @Test
    void checksThatSiretAndVatNumberReferToTheSameCompany() {
        assertTrue(validator.referToSameCompany("38012986600014", "FR89380129866"));
        assertFalse(validator.referToSameCompany("73282932000074", "FR89380129866"));
    }
}
