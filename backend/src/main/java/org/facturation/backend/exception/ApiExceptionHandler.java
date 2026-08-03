package org.facturation.backend.exception;

import org.facturation.backend.dto.response.InvoiceOcrFailureResponse;
import org.facturation.backend.mapper.OcrErrorMapper;
import org.facturation.backend.model.InvoiceStatusCode;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

@RestControllerAdvice
public class ApiExceptionHandler {

    private final OcrErrorMapper ocrErrorMapper;

    public ApiExceptionHandler(OcrErrorMapper ocrErrorMapper) {
        this.ocrErrorMapper = ocrErrorMapper;
    }

    @ExceptionHandler(InvalidInvoiceFileException.class)
    public ResponseEntity<Map<String, String>> handleInvalidInvoiceFile(InvalidInvoiceFileException exception) {
        return ResponseEntity.badRequest().body(Map.of("message", exception.getMessage()));
    }

    @ExceptionHandler(InvoiceOcrFailureException.class)
    public ResponseEntity<InvoiceOcrFailureResponse> handleInvoiceOcrFailure(
            InvoiceOcrFailureException exception
    ) {
        InvoiceOcrFailureResponse response = new InvoiceOcrFailureResponse();
        response.setInvoiceId(exception.getInvoiceId());
        response.setStatus(InvoiceStatusCode.ERREUR_OCR.getCode());
        response.setOcrError(ocrErrorMapper.toResponse(exception.getOcrError()));
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(response);
    }

    @ExceptionHandler(OcrRetryNotAllowedException.class)
    public ResponseEntity<Map<String, String>> handleOcrRetryNotAllowed(OcrRetryNotAllowedException exception) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("message", exception.getMessage()));
    }
}
