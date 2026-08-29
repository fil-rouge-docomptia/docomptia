package org.facturation.backend.service;

import org.facturation.backend.exception.InvalidInvoiceFileException;
import org.facturation.backend.model.InvoiceFileFormat;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.unit.DataSize;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.util.Arrays;
import java.util.Locale;

@Service
public class InvoiceFileValidator {

    private static final int SIGNATURE_LENGTH = 8;

    private final DataSize maxFileSize;

    public InvoiceFileValidator(@Value("${app.invoice-upload.max-file-size:10MB}") DataSize maxFileSize) {
        this.maxFileSize = maxFileSize;
    }

    public void validate(MultipartFile file) {
        validatePresenceAndSize(file);

        InvoiceFileFormat expectedType = findTypeByExtension(file.getOriginalFilename());
        validateMimeType(file.getContentType(), expectedType);

        InvoiceFileFormat detectedType = detectType(readSignature(file));
        if (detectedType == null || detectedType != expectedType) {
            throw new InvalidInvoiceFileException("File content does not match its extension");
        }
    }

    private void validatePresenceAndSize(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new InvalidInvoiceFileException("File must not be empty");
        }
        if (file.getSize() > maxFileSize.toBytes()) {
            throw new InvalidInvoiceFileException(
                    "File exceeds the maximum allowed size of " + maxFileSize.toMegabytes() + " MB"
            );
        }
    }

    private InvoiceFileFormat findTypeByExtension(String filename) {
        if (filename == null || filename.isBlank() || !filename.contains(".")) {
            throw unsupportedFileType();
        }

        String extension = filename.substring(filename.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
        return Arrays.stream(InvoiceFileFormat.values())
                .filter(type -> type.supportsExtension(extension))
                .findFirst()
                .orElseThrow(this::unsupportedFileType);
    }

    private void validateMimeType(String mimeType, InvoiceFileFormat expectedType) {
        String normalizedMimeType = mimeType == null ? "" : mimeType.trim().toLowerCase(Locale.ROOT);
        if (!expectedType.supportsMimeType(normalizedMimeType)) {
            throw new InvalidInvoiceFileException("File MIME type does not match its extension");
        }
    }

    private byte[] readSignature(MultipartFile file) {
        try (InputStream inputStream = file.getInputStream()) {
            return inputStream.readNBytes(SIGNATURE_LENGTH);
        } catch (IOException exception) {
            throw new InvalidInvoiceFileException("Unable to read the uploaded file", exception);
        }
    }

    private InvoiceFileFormat detectType(byte[] signature) {
        return Arrays.stream(InvoiceFileFormat.values())
                .filter(type -> startsWith(signature, type.getSignature()))
                .findFirst()
                .orElse(null);
    }

    private boolean startsWith(byte[] content, byte[] prefix) {
        if (content.length < prefix.length) {
            return false;
        }
        for (int index = 0; index < prefix.length; index++) {
            if (content[index] != prefix[index]) {
                return false;
            }
        }
        return true;
    }

    private InvalidInvoiceFileException unsupportedFileType() {
        return new InvalidInvoiceFileException("Supported file types are PDF, PNG and JPEG");
    }
}
