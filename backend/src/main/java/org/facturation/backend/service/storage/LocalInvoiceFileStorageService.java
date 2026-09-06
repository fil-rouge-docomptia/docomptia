package org.facturation.backend.service.storage;

import org.facturation.backend.exception.InvoiceFileNotFoundException;
import org.facturation.backend.model.InvoiceFile;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.NoSuchFileException;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.UUID;

@Service
@ConditionalOnProperty(name = "app.storage.type", havingValue = "local", matchIfMissing = true)
public class LocalInvoiceFileStorageService implements InvoiceFileStorageService {

    private final String localDirectory;

    public LocalInvoiceFileStorageService(@Value("${app.storage.local-dir:}") String localDirectory) {
        this.localDirectory = localDirectory;
    }

    @Override
    public StoredInvoiceFile store(MultipartFile file, Long invoiceId) {
        String originalFileName = resolveOriginalFileName(file);
        String storedFileName = invoiceId + "-" + UUID.randomUUID() + "-" + originalFileName;
        Path directory = resolveDirectory();
        Path target = directory.resolve(storedFileName);

        try {
            Files.createDirectories(directory);
            Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
            return new StoredInvoiceFile(
                    originalFileName,
                    storedFileName,
                    target.toString(),
                    resolveMimeType(file),
                    file.getSize()
            );
        } catch (IOException exception) {
            throw new IllegalStateException("Unable to store uploaded file", exception);
        }
    }

    @Override
    public MultipartFile load(InvoiceFile invoiceFile) {
        try {
            byte[] content = Files.readAllBytes(Path.of(invoiceFile.getFilePath()));
            return new StoredMultipartFile(
                    invoiceFile.getOriginalFileName(),
                    invoiceFile.getMimeType(),
                    content
            );
        } catch (NoSuchFileException exception) {
            throw new InvoiceFileNotFoundException(invoiceFile.getInvoice().getInvoiceId());
        } catch (IOException exception) {
            throw new IllegalStateException("Unable to read stored invoice file", exception);
        }
    }

    private Path resolveDirectory() {
        if (localDirectory == null || localDirectory.isBlank()) {
            return Path.of(System.getProperty("java.io.tmpdir"), "facturation-files");
        }
        return Path.of(localDirectory);
    }

    private String resolveOriginalFileName(MultipartFile file) {
        return sanitize(file.getOriginalFilename() == null ? "invoice-file" : file.getOriginalFilename());
    }

    private String resolveMimeType(MultipartFile file) {
        return file.getContentType() == null ? "application/octet-stream" : file.getContentType();
    }

    private String sanitize(String fileName) {
        return fileName.replace("\\", "_").replace("/", "_");
    }
}
