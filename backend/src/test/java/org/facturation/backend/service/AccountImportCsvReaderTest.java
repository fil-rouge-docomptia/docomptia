package org.facturation.backend.service;

import org.facturation.backend.exception.AccountImportException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.*;

class AccountImportCsvReaderTest {
    private final AccountImportCsvReader reader = new AccountImportCsvReader();

    @Test
    void readsUtf8BomSemicolonsEscapedQuotesAndMultilineFieldsWithPhysicalLineNumbers() {
        var csv = reader.read(file("\uFEFFnumber;label;type\r\n001ABC;\"Équipement; \"\"bureau\"\"\r\nParis\";CHARGE\r\n\r\n002;Next;ACTIF\r\n"), ";");
        assertEquals("001ABC", csv.records().getFirst().cells().getFirst());
        assertEquals("Équipement; \"bureau\"\r\nParis", csv.records().getFirst().cells().get(1));
        assertEquals(2, csv.records().getFirst().lineNumber());
        assertEquals(5, csv.records().getLast().lineNumber());
    }

    @Test
    void preservesEmptyTrailingFieldsAndAcceptsAFileWithoutFinalNewline() {
        var csv = reader.read(file("number,label,type,active\n001,Label,CHARGE,"), ",");
        assertEquals(4, csv.records().getFirst().cells().size());
        assertEquals("", csv.records().getFirst().cells().getLast());
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "number,label,type", "a,a,c\n1,2,3", "a,,c\n1,2,3", "a,b\n1,2",
            "a,b,c\n1,\"unclosed,3", "a,b,c\n1,a\"b,3", "a,b,c\n1,\"a\"b,3", "a,b,c\n1,\u0000,3"})
    void rejectsEmptyMalformedOrBinaryCsv(String content) {
        assertThrows(AccountImportException.class, () -> reader.read(file(content), ","));
    }

    @Test
    void rejectsNonUtf8AndUnsupportedExtensionOrMime() {
        assertThrows(AccountImportException.class, () -> reader.read(new MockMultipartFile("file", "plan.csv", "text/csv", new byte[]{(byte) 0xc3, 0x28}), ","));
        assertThrows(AccountImportException.class, () -> reader.read(new MockMultipartFile("file", "plan.xlsx", "text/csv", new byte[]{1}), ","));
        assertThrows(AccountImportException.class, () -> reader.read(new MockMultipartFile("file", "plan.csv", "application/pdf", new byte[]{1}), ","));
    }

    @Test
    void enforcesFileRowColumnAndFieldLimits() {
        var huge = new MockMultipartFile("file", "plan.csv", "text/csv", new byte[]{1}) {
            @Override public long getSize() { return AccountImportCsvReader.MAX_BYTES + 1L; }
        };
        assertEquals(413, assertThrows(AccountImportException.class, () -> reader.read(huge, ",")).getStatus().value());
        assertThrows(AccountImportException.class, () -> reader.read(file("a,b,c\n" + "1,2,3\n".repeat(10001)), ","));
        assertThrows(AccountImportException.class, () -> reader.read(file("a,".repeat(101)), ","));
        assertThrows(AccountImportException.class, () -> reader.read(file("a,b,c\n1," + "x".repeat(8193) + ",3"), ","));
        assertThrows(AccountImportException.class, () -> reader.read(file("a,b,c\n1,2,3"), "|"));
    }

    private MockMultipartFile file(String text) {
        return new MockMultipartFile("file", "plan.csv", "text/csv", text.getBytes(StandardCharsets.UTF_8));
    }
}
