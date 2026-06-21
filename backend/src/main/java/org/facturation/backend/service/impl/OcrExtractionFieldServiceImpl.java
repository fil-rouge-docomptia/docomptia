package org.facturation.backend.service.impl;

import org.facturation.backend.model.OcrExtractionField;
import org.facturation.backend.repository.OcrExtractionFieldRepository;
import org.facturation.backend.service.OcrExtractionFieldService;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class OcrExtractionFieldServiceImpl implements OcrExtractionFieldService {

    private final OcrExtractionFieldRepository ocrExtractionFieldRepository;

    public OcrExtractionFieldServiceImpl(OcrExtractionFieldRepository ocrExtractionFieldRepository) {
        this.ocrExtractionFieldRepository = ocrExtractionFieldRepository;
    }

    @Override
    public List<OcrExtractionField> findAll() {
        return ocrExtractionFieldRepository.findAll();
    }

    @Override
    public Optional<OcrExtractionField> findById(Long id) {
        return ocrExtractionFieldRepository.findById(id);
    }

    @Override
    public OcrExtractionField save(OcrExtractionField ocrExtractionField) {
        return ocrExtractionFieldRepository.save(ocrExtractionField);
    }
}
