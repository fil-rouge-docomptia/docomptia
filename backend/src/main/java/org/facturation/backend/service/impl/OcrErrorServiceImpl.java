package org.facturation.backend.service.impl;

import org.facturation.backend.exception.OcrClientException;
import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.OcrError;
import org.facturation.backend.model.OcrErrorCode;
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
        OcrError error = new OcrError();
        error.setInvoice(invoice);
        error.setErrorCode(resolveErrorCode(exception));
        error.setErrorMessage(resolveErrorMessage(exception));
        error.setOccurredAt(LocalDateTime.now());
        return ocrErrorRepository.save(error);
    }

    @Override
    public Optional<OcrError> findLatestByInvoiceId(Long invoiceId) {
        return ocrErrorRepository.findTopByInvoiceInvoiceIdOrderByOcrErrorIdDesc(invoiceId);
    }

    private String resolveErrorCode(RuntimeException exception) {
        if (exception instanceof OcrClientException ocrException) {
            return ocrException.getErrorCode().getCode();
        }
        return OcrErrorCode.PROCESSING_FAILED.getCode();
    }

    private String resolveErrorMessage(RuntimeException exception) {
        if (!(exception instanceof OcrClientException) || exception.getMessage() == null) {
            return DEFAULT_ERROR_MESSAGE;
        }

        String message = exception.getMessage().trim();
        if (message.isEmpty()) {
            return DEFAULT_ERROR_MESSAGE;
        }
        return message.substring(0, Math.min(message.length(), MAX_ERROR_MESSAGE_LENGTH));
    }
}
