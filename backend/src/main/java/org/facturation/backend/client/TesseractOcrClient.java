package org.facturation.backend.client;

import net.sourceforge.tess4j.Tesseract;
import net.sourceforge.tess4j.TesseractException;
import org.facturation.backend.config.OcrProperties;
import org.facturation.backend.dto.response.OcrAnalysisResponse;
import org.facturation.backend.service.ocr.InvoiceOcrFieldExtractor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.util.Set;

@Component
@ConditionalOnProperty(name = "ocr.engine", havingValue = "tesseract", matchIfMissing = true)
public class TesseractOcrClient implements OcrClient {

    private static final Set<String> SUPPORTED_CONTENT_TYPES = Set.of("image/png", "image/jpeg", "image/jpg");
    private static final Set<String> SUPPORTED_EXTENSIONS = Set.of("png", "jpg", "jpeg");

    private final OcrProperties ocrProperties;
    private final InvoiceOcrFieldExtractor invoiceOcrFieldExtractor;

    public TesseractOcrClient(OcrProperties ocrProperties, InvoiceOcrFieldExtractor invoiceOcrFieldExtractor) {
        this.ocrProperties = ocrProperties;
        this.invoiceOcrFieldExtractor = invoiceOcrFieldExtractor;
    }

    @Override
    public OcrAnalysisResponse analyze(MultipartFile file) {
        validateSupportedImage(file);

        File tempFile = null;
        try {
            tempFile = createTempFile(file);
            BufferedImage image = ImageIO.read(tempFile);
            if (image == null) {
                throw new IllegalArgumentException("Unsupported image content");
            }

            Tesseract tesseract = createTesseract();
            String rawText = tesseract.doOCR(image);

            OcrAnalysisResponse response = new OcrAnalysisResponse();
            response.setStatus("SUCCESS");
            response.setRawText(rawText);
            response.setFields(invoiceOcrFieldExtractor.extract(rawText));
            return response;
        } catch (IOException exception) {
            throw new IllegalStateException("Unable to read uploaded image", exception);
        } catch (TesseractException exception) {
            throw new IllegalStateException("Unable to process image with Tesseract", exception);
        } finally {
            deleteTempFile(tempFile);
        }
    }

    @Override
    public String getEngineName() {
        return "tesseract";
    }

    @Override
    public String getEngineVersion() {
        return "5";
    }

    private void validateSupportedImage(MultipartFile file) {
        String contentType = file.getContentType();
        String extension = extractExtension(file.getOriginalFilename());

        if (!SUPPORTED_CONTENT_TYPES.contains(contentType) || !SUPPORTED_EXTENSIONS.contains(extension)) {
            throw new IllegalArgumentException("Only PNG and JPEG images are supported for OCR in the MVP");
        }
    }

    private File createTempFile(MultipartFile file) throws IOException {
        String extension = extractExtension(file.getOriginalFilename());
        File tempFile = Files.createTempFile("ocr-upload-", "." + extension).toFile();
        file.transferTo(tempFile);
        return tempFile;
    }

    private Tesseract createTesseract() {
        Tesseract tesseract = new Tesseract();
        tesseract.setLanguage(ocrProperties.getLanguage());

        String tessdataPath = ocrProperties.getTessdataPath();
        if (tessdataPath != null && !tessdataPath.isBlank()) {
            tesseract.setDatapath(tessdataPath);
        }

        return tesseract;
    }

    private void deleteTempFile(File tempFile) {
        if (tempFile != null && tempFile.exists()) {
            tempFile.delete();
        }
    }

    private String extractExtension(String fileName) {
        if (fileName == null || !fileName.contains(".")) {
            return "";
        }
        return fileName.substring(fileName.lastIndexOf('.') + 1).toLowerCase();
    }
}
