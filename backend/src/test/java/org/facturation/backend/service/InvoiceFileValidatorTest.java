package org.facturation.backend.service;

import org.facturation.backend.exception.InvalidInvoiceFileException;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.util.unit.DataSize;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

class InvoiceFileValidatorTest {

    private static final byte[] PDF_CONTENT = "%PDF-1.4".getBytes();
    private static final byte[] PNG_CONTENT = new byte[]{
            (byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A
    };
    private static final byte[] JPEG_CONTENT = new byte[]{
            (byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0
    };

    private final InvoiceFileValidator validator = new InvoiceFileValidator(DataSize.ofMegabytes(10));

    @Test
    void acceptsSupportedFiles() {
        assertDoesNotThrow(() -> validator.validate(file("invoice.pdf", "application/pdf", PDF_CONTENT)));
        assertDoesNotThrow(() -> validator.validate(file("invoice.png", "image/png", PNG_CONTENT)));
        assertDoesNotThrow(() -> validator.validate(file("invoice.jpg", "image/jpeg", JPEG_CONTENT)));
        assertDoesNotThrow(() -> validator.validate(file("invoice.jpeg", "image/jpeg", JPEG_CONTENT)));
    }

    @Test
    void rejectsEmptyFile() {
        assertThrows(
                InvalidInvoiceFileException.class,
                () -> validator.validate(file("invoice.png", "image/png", new byte[0]))
        );
    }

    @Test
    void rejectsFileLargerThanConfiguredLimit() {
        byte[] oversizedContent = new byte[(int) DataSize.ofMegabytes(10).toBytes() + 1];

        assertThrows(
                InvalidInvoiceFileException.class,
                () -> validator.validate(file("invoice.png", "image/png", oversizedContent))
        );
    }

    @Test
    void rejectsUnsupportedExtension() {
        assertThrows(
                InvalidInvoiceFileException.class,
                () -> validator.validate(file("invoice.txt", "text/plain", "invoice".getBytes()))
        );
    }

    @Test
    void rejectsMimeTypeThatDoesNotMatchExtension() {
        assertThrows(
                InvalidInvoiceFileException.class,
                () -> validator.validate(file("invoice.png", "application/pdf", PNG_CONTENT))
        );
    }

    @Test
    void rejectsContentThatDoesNotMatchExtension() {
        assertThrows(
                InvalidInvoiceFileException.class,
                () -> validator.validate(file("invoice.png", "image/png", PDF_CONTENT))
        );
    }

    private MockMultipartFile file(String filename, String contentType, byte[] content) {
        return new MockMultipartFile("file", filename, contentType, content);
    }
}
