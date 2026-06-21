package org.facturation.backend.service.impl;

import org.facturation.backend.model.OcrExtraction;
import org.facturation.backend.repository.OcrExtractionRepository;
import org.facturation.backend.service.OcrExtractionService;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class OcrExtractionServiceImpl implements OcrExtractionService {

    private final OcrExtractionRepository ocrExtractionRepository;

    public OcrExtractionServiceImpl(OcrExtractionRepository ocrExtractionRepository) {
        this.ocrExtractionRepository = ocrExtractionRepository;
    }

    @Override
    public List<OcrExtraction> findAll() {
        return ocrExtractionRepository.findAll();
    }

    @Override
    public Optional<OcrExtraction> findById(Long id) {
        return ocrExtractionRepository.findById(id);
    }

    @Override
    public OcrExtraction save(OcrExtraction ocrExtraction) {
        return ocrExtractionRepository.save(ocrExtraction);
    }
}
