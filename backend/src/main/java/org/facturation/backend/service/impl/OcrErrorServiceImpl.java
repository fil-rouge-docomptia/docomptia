package org.facturation.backend.service.impl;

import org.facturation.backend.exception.OcrClientException;
import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.OcrError;
import org.facturation.backend.model.OcrErrorCode;
import org.facturation.backend.model.OcrErrorStep;
import org.facturation.backend.repository.OcrErrorRepository;
import org.facturation.backend.service.OcrErrorService;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Optional;

@Service
public class OcrErrorServiceImpl implements OcrErrorService {

    private static final int MAX_ERROR_MESSAGE_LENGTH = 1000;
    private static final String DEFAULT_ERROR_MESSAGE = "OCR processing failed";

    private final OcrErrorRepository ocrErrorRepository;

    public OcrErrorServiceImpl(OcrErrorRepository ocrErrorRepository) {
        this.ocrErrorRepository = ocrErrorRepository;
    }

    @Override
    public OcrError recordFailure(Invoice invoice, RuntimeException exception) {
        return recordFailure(invoice, exception, OcrErrorStep.OCR_ANALYSIS);
    }

    @Override
    public OcrError recordFailure(Invoice invoice, RuntimeException exception, OcrErrorStep step) {
        OcrError error = new OcrError();
        error.setInvoice(invoice);
        error.setErrorCode(resolveErrorCode(exception, step));
        error.setErrorMessage(resolveErrorMessage(exception, step));
        error.setErrorStep(step.name());
        error.setOccurredAt(LocalDateTime.now());
        return ocrErrorRepository.save(error);
    }

    @Override
    public Optional<OcrError> findLatestByInvoiceId(Long invoiceId) {
        return ocrErrorRepository.findTopByInvoiceInvoiceIdOrderByOcrErrorIdDesc(invoiceId);
    }

    private String resolveErrorCode(RuntimeException exception, OcrErrorStep step) {
        if (step == OcrErrorStep.OCR_ANALYSIS && exception instanceof OcrClientException ocrException) {
            return ocrException.getErrorCode().getCode();
        }
        return switch (step) {
            case OCR_ANALYSIS -> OcrErrorCode.PROCESSING_FAILED.getCode();
            case SUPPLIER_RESOLUTION -> OcrErrorCode.SUPPLIER_RESOLUTION_FAILED.getCode();
            case EXTRACTION_PERSISTENCE -> OcrErrorCode.EXTRACTION_PERSISTENCE_FAILED.getCode();
            case STATUS_UPDATE -> OcrErrorCode.STATUS_UPDATE_FAILED.getCode();
        };
    }

    private String resolveErrorMessage(RuntimeException exception, OcrErrorStep step) {
        if (step != OcrErrorStep.OCR_ANALYSIS
                || !(exception instanceof OcrClientException)
                || exception.getMessage() == null) {
            return DEFAULT_ERROR_MESSAGE;
        }

        String message = exception.getMessage().trim();
        if (message.isEmpty()) {
            return DEFAULT_ERROR_MESSAGE;
        }
        return message.substring(0, Math.min(message.length(), MAX_ERROR_MESSAGE_LENGTH));
    }
}
