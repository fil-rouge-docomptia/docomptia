package org.facturation.backend.service;

import org.facturation.backend.model.ProcessingAnomalyCode;
import org.facturation.backend.model.Supplier;

import java.util.List;

public record OcrSupplierResolution(Supplier supplier, List<ProcessingAnomalyCode> anomalies) {

    public OcrSupplierResolution {
        anomalies = List.copyOf(anomalies);
    }
}
