package org.facturation.backend.service.impl;

import org.facturation.backend.model.OcrExtraction;
import org.facturation.backend.repository.OcrExtractionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OcrExtractionServiceImplTest {

    @Mock
    private OcrExtractionRepository ocrExtractionRepository;

    @InjectMocks
    private OcrExtractionServiceImpl ocrExtractionService;

    @Test
    void findAllReturnsOcrExtractionsFromRepository() {
        OcrExtraction ocrExtraction = new OcrExtraction();
        when(ocrExtractionRepository.findAll()).thenReturn(List.of(ocrExtraction));

        List<OcrExtraction> ocrExtractions = ocrExtractionService.findAll();

        assertEquals(1, ocrExtractions.size());
        assertSame(ocrExtraction, ocrExtractions.get(0));
        verify(ocrExtractionRepository).findAll();
    }

    @Test
    void findByIdReturnsOcrExtractionFromRepository() {
        OcrExtraction ocrExtraction = new OcrExtraction();
        when(ocrExtractionRepository.findById(1L)).thenReturn(Optional.of(ocrExtraction));

        Optional<OcrExtraction> result = ocrExtractionService.findById(1L);

        assertSame(ocrExtraction, result.orElseThrow());
        verify(ocrExtractionRepository).findById(1L);
    }

    @Test
    void saveDelegatesToRepository() {
        OcrExtraction ocrExtraction = new OcrExtraction();
        when(ocrExtractionRepository.save(ocrExtraction)).thenReturn(ocrExtraction);

        OcrExtraction savedOcrExtraction = ocrExtractionService.save(ocrExtraction);

        assertSame(ocrExtraction, savedOcrExtraction);
        verify(ocrExtractionRepository).save(ocrExtraction);
    }
}
