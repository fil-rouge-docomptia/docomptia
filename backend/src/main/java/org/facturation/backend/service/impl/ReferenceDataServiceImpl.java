package org.facturation.backend.service.impl;

import org.facturation.backend.dto.response.ReferenceDataResponse;
import org.facturation.backend.dto.response.ReferenceItemResponse;
import org.facturation.backend.model.InvoiceFileFormat;
import org.facturation.backend.model.InvoiceStatus;
import org.facturation.backend.model.InvoiceStatusCode;
import org.facturation.backend.model.Role;
import org.facturation.backend.service.InvoiceStatusService;
import org.facturation.backend.service.ReferenceDataService;
import org.facturation.backend.service.RoleService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.Currency;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class ReferenceDataServiceImpl implements ReferenceDataService {

    private static final Locale FRENCH_LOCALE = Locale.FRENCH;

    private final InvoiceStatusService invoiceStatusService;
    private final RoleService roleService;

    public ReferenceDataServiceImpl(InvoiceStatusService invoiceStatusService, RoleService roleService) {
        this.invoiceStatusService = invoiceStatusService;
        this.roleService = roleService;
    }

    @Override
    @Transactional(readOnly = true)
    public ReferenceDataResponse getReferenceData() {
        return new ReferenceDataResponse(
                invoiceStatuses(),
                roles(),
                currencies(),
                invoiceFileFormats()
        );
    }

    private List<ReferenceItemResponse> invoiceStatuses() {
        Map<String, InvoiceStatus> statusesByCode = invoiceStatusService.findAll().stream()
                .collect(Collectors.toMap(InvoiceStatus::getCode, Function.identity()));

        return Arrays.stream(InvoiceStatusCode.values())
                .map(statusCode -> {
                    InvoiceStatus status = statusesByCode.get(statusCode.getCode());
                    if (status == null) {
                        throw new IllegalStateException("Invoice status " + statusCode.getCode() + " not found");
                    }
                    return new ReferenceItemResponse(status.getCode(), status.getLabel());
                })
                .toList();
    }

    private List<ReferenceItemResponse> roles() {
        return roleService.findAll().stream()
                .map(this::toReferenceItem)
                .toList();
    }

    private ReferenceItemResponse toReferenceItem(Role role) {
        return new ReferenceItemResponse(role.getCode(), role.getLabel());
    }

    private List<ReferenceItemResponse> currencies() {
        return Currency.getAvailableCurrencies().stream()
                .sorted((left, right) -> left.getCurrencyCode().compareTo(right.getCurrencyCode()))
                .map(currency -> new ReferenceItemResponse(
                        currency.getCurrencyCode(),
                        currency.getDisplayName(FRENCH_LOCALE)
                ))
                .toList();
    }

    private List<ReferenceItemResponse> invoiceFileFormats() {
        return Arrays.stream(InvoiceFileFormat.values())
                .map(format -> new ReferenceItemResponse(format.getCode(), format.getLabel()))
                .toList();
    }
}
