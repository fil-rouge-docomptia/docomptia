package org.facturation.backend.service.impl;

import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.OcrError;
import org.facturation.backend.model.OcrErrorCode;
import org.facturation.backend.model.OcrErrorStep;
import org.facturation.backend.repository.OcrErrorRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OcrErrorServiceImplTest {

    @Mock
    private OcrErrorRepository ocrErrorRepository;

    @Test
    void mapsPostOcrStepsToSafeErrors() {
        when(ocrErrorRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        OcrErrorServiceImpl service = new OcrErrorServiceImpl(ocrErrorRepository);
        Invoice invoice = new Invoice();
        RuntimeException technicalFailure = new IllegalStateException("secret technical detail");

        assertError(
                service.recordFailure(invoice, technicalFailure, OcrErrorStep.SUPPLIER_RESOLUTION),
                OcrErrorCode.SUPPLIER_RESOLUTION_FAILED,
                OcrErrorStep.SUPPLIER_RESOLUTION
        );
        assertError(
                service.recordFailure(invoice, technicalFailure, OcrErrorStep.EXTRACTION_PERSISTENCE),
                OcrErrorCode.EXTRACTION_PERSISTENCE_FAILED,
                OcrErrorStep.EXTRACTION_PERSISTENCE
        );
        assertError(
                service.recordFailure(invoice, technicalFailure, OcrErrorStep.STATUS_UPDATE),
                OcrErrorCode.STATUS_UPDATE_FAILED,
                OcrErrorStep.STATUS_UPDATE
        );
    }

    private void assertError(OcrError error, OcrErrorCode expectedCode, OcrErrorStep expectedStep) {
        assertEquals(expectedCode.getCode(), error.getErrorCode());
        assertEquals(expectedStep.name(), error.getErrorStep());
        assertFalse(error.getErrorMessage().contains("secret"));
    }
}
