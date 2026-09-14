package org.facturation.backend.service.impl;

import org.facturation.backend.dto.response.ProcessingAnomalyResponse;
import org.facturation.backend.exception.InvoiceNotFoundException;
import org.facturation.backend.exception.ProcessingAnomalyNotFoundException;
import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.ProcessingAnomaly;
import org.facturation.backend.model.ProcessingAnomalyCode;
import org.facturation.backend.model.User;
import org.facturation.backend.repository.InvoiceRepository;
import org.facturation.backend.repository.ProcessingAnomalyRepository;
import org.facturation.backend.service.CurrentUserService;
import org.facturation.backend.service.ProcessingAnomalyService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class ProcessingAnomalyServiceImpl implements ProcessingAnomalyService {

    private final CurrentUserService currentUserService;
    private final InvoiceRepository invoiceRepository;
    private final ProcessingAnomalyRepository processingAnomalyRepository;

    public ProcessingAnomalyServiceImpl(
            CurrentUserService currentUserService,
            InvoiceRepository invoiceRepository,
            ProcessingAnomalyRepository processingAnomalyRepository
    ) {
        this.currentUserService = currentUserService;
        this.invoiceRepository = invoiceRepository;
        this.processingAnomalyRepository = processingAnomalyRepository;
    }

    @Override
    @Transactional
    public ProcessingAnomalyResponse create(Long invoiceId, ProcessingAnomalyCode code) {
        User currentUser = currentUserService.getCurrentUser();
        Long organizationId = currentUser.getOrganization().getOrganizationId();
        Invoice invoice = invoiceRepository.findByInvoiceIdAndOrganizationOrganizationId(invoiceId, organizationId)
                .orElseThrow(() -> new InvoiceNotFoundException(invoiceId));

        var activeAnomaly = processingAnomalyRepository
                .findByInvoiceInvoiceIdAndCodeAndResolvedAtIsNull(invoiceId, code);
        if (activeAnomaly.isPresent()) {
            return toResponse(activeAnomaly.get());
        }

        ProcessingAnomaly anomaly = new ProcessingAnomaly();
        anomaly.setInvoice(invoice);
        anomaly.setOrganization(invoice.getOrganization());
        anomaly.setCode(code);
        anomaly.setCreatedAt(LocalDateTime.now());
        return toResponse(processingAnomalyRepository.save(anomaly));
    }

    @Override
    @Transactional(readOnly = true)
    public List<ProcessingAnomalyResponse> getDashboardAnomalies(boolean includeResolved) {
        Long organizationId = currentUserService.getCurrentUser().getOrganization().getOrganizationId();
        List<ProcessingAnomaly> anomalies = includeResolved
                ? processingAnomalyRepository
                        .findByOrganizationOrganizationIdOrderByCreatedAtDescProcessingAnomalyIdDesc(organizationId)
                : processingAnomalyRepository
                        .findByOrganizationOrganizationIdAndResolvedAtIsNullOrderByCreatedAtDescProcessingAnomalyIdDesc(
                                organizationId
                        );
        return anomalies.stream().map(this::toResponse).toList();
    }

    @Override
    @Transactional
    public ProcessingAnomalyResponse resolve(Long invoiceId, Long anomalyId) {
        User currentUser = currentUserService.getCurrentUser();
        Long organizationId = currentUser.getOrganization().getOrganizationId();
        ProcessingAnomaly anomaly = processingAnomalyRepository
                .findByProcessingAnomalyIdAndInvoiceInvoiceIdAndOrganizationOrganizationId(
                        anomalyId,
                        invoiceId,
                        organizationId
                )
                .orElseThrow(() -> new ProcessingAnomalyNotFoundException(anomalyId));

        if (anomaly.getResolvedAt() == null) {
            anomaly.setResolvedAt(LocalDateTime.now());
            anomaly.setResolvedByUser(currentUser);
        }
        return toResponse(anomaly);
    }

    private ProcessingAnomalyResponse toResponse(ProcessingAnomaly anomaly) {
        ProcessingAnomalyCode code = anomaly.getCode();
        return new ProcessingAnomalyResponse(
                anomaly.getProcessingAnomalyId(),
                anomaly.getInvoice().getInvoiceId(),
                anomaly.getInvoice().getInvoiceNumber(),
                anomaly.getOrganization().getOrganizationId(),
                code.getCode(),
                code.getLabel(),
                code.getDescription(),
                anomaly.isBlocking(),
                anomaly.getCreatedAt(),
                anomaly.getResolvedAt()
        );
    }
}
