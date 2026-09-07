package org.facturation.backend.service.impl;

import org.facturation.backend.dto.request.CustomerInvoiceDraftRequest;
import org.facturation.backend.dto.response.CustomerInvoiceDraftResponse;
import org.facturation.backend.exception.ClientNotFoundException;
import org.facturation.backend.exception.CustomerInvoiceDraftNotModifiableException;
import org.facturation.backend.exception.InvalidCustomerInvoiceDraftException;
import org.facturation.backend.exception.InvoiceNotFoundException;
import org.facturation.backend.model.Client;
import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.InvoiceStatusCode;
import org.facturation.backend.model.Organization;
import org.facturation.backend.model.User;
import org.facturation.backend.repository.ClientRepository;
import org.facturation.backend.repository.InvoiceRepository;
import org.facturation.backend.service.CurrentUserService;
import org.facturation.backend.service.CustomerInvoiceDraftService;
import org.facturation.backend.service.InvoiceStatusWorkflowService;
import org.facturation.backend.service.SubscriptionQuotaService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Currency;
import java.util.Locale;
import java.util.Objects;

@Service
public class CustomerInvoiceDraftServiceImpl implements CustomerInvoiceDraftService {

    private final InvoiceRepository invoiceRepository;
    private final ClientRepository clientRepository;
    private final CurrentUserService currentUserService;
    private final InvoiceStatusWorkflowService invoiceStatusWorkflowService;
    private final SubscriptionQuotaService subscriptionQuotaService;

    public CustomerInvoiceDraftServiceImpl(
            InvoiceRepository invoiceRepository,
            ClientRepository clientRepository,
            CurrentUserService currentUserService,
            InvoiceStatusWorkflowService invoiceStatusWorkflowService,
            SubscriptionQuotaService subscriptionQuotaService
    ) {
        this.invoiceRepository = invoiceRepository;
        this.clientRepository = clientRepository;
        this.currentUserService = currentUserService;
        this.invoiceStatusWorkflowService = invoiceStatusWorkflowService;
        this.subscriptionQuotaService = subscriptionQuotaService;
    }

    @Override
    @Transactional
    public CustomerInvoiceDraftResponse create(CustomerInvoiceDraftRequest request) {
        if (request == null) {
            throw new InvalidCustomerInvoiceDraftException("Request body is required");
        }

        User user = currentUserService.getCurrentUser();
        Organization organization = user.getOrganization();
        Client client = findClient(request.getClientId(), organization.getOrganizationId());
        String currencyCode = requireCurrencyCode(request.getCurrencyCode());
        subscriptionQuotaService.ensureInvoiceCanBeCreated(organization.getOrganizationId());
        LocalDateTime now = LocalDateTime.now();

        Invoice invoice = new Invoice();
        invoice.setOrganization(organization);
        invoice.setClient(client);
        invoice.setInvoiceStatus(invoiceStatusWorkflowService.findByCode(InvoiceStatusCode.BROUILLON));
        invoice.setCreatedByUser(user);
        invoice.setCurrencyCode(currencyCode);
        invoice.setInvoiceDate(request.getInvoiceDate());
        invoice.setDueDate(request.getDueDate());
        invoice.setCommandReference(normalizeOptionalText(request.getCommandReference()));
        invoice.setDescription(normalizeOptionalText(request.getDescription()));
        invoice.setCreatedAt(now);
        invoice.setUpdatedAt(now);

        return toResponse(invoiceRepository.save(invoice));
    }

    @Override
    @Transactional
    public CustomerInvoiceDraftResponse update(Long invoiceId, CustomerInvoiceDraftRequest request) {
        if (request == null) {
            throw new InvalidCustomerInvoiceDraftException("Request body is required");
        }

        User user = currentUserService.getCurrentUser();
        Invoice invoice = invoiceRepository.findByInvoiceIdAndOrganizationOrganizationId(
                invoiceId,
                user.getOrganization().getOrganizationId()
        ).orElseThrow(() -> new InvoiceNotFoundException(invoiceId));
        ensureCustomerDraft(invoice);

        boolean changed = false;
        if (request.getClientId() != null) {
            Client client = findClient(request.getClientId(), user.getOrganization().getOrganizationId());
            if (!Objects.equals(invoice.getClient().getClientId(), client.getClientId())) {
                invoice.setClient(client);
                changed = true;
            }
        }
        if (request.getCurrencyCode() != null) {
            String currencyCode = requireCurrencyCode(request.getCurrencyCode());
            if (!Objects.equals(invoice.getCurrencyCode(), currencyCode)) {
                invoice.setCurrencyCode(currencyCode);
                changed = true;
            }
        }
        if (request.getInvoiceDate() != null && !Objects.equals(invoice.getInvoiceDate(), request.getInvoiceDate())) {
            invoice.setInvoiceDate(request.getInvoiceDate());
            changed = true;
        }
        if (request.getDueDate() != null && !Objects.equals(invoice.getDueDate(), request.getDueDate())) {
            invoice.setDueDate(request.getDueDate());
            changed = true;
        }
        if (request.getCommandReference() != null) {
            String commandReference = normalizeOptionalText(request.getCommandReference());
            if (!Objects.equals(invoice.getCommandReference(), commandReference)) {
                invoice.setCommandReference(commandReference);
                changed = true;
            }
        }
        if (request.getDescription() != null) {
            String description = normalizeOptionalText(request.getDescription());
            if (!Objects.equals(invoice.getDescription(), description)) {
                invoice.setDescription(description);
                changed = true;
            }
        }
        if (!changed) {
            throw new InvalidCustomerInvoiceDraftException("At least one changed field is required");
        }

        invoice.setUpdatedAt(LocalDateTime.now());
        return toResponse(invoiceRepository.save(invoice));
    }

    private Client findClient(Long clientId, Long organizationId) {
        if (clientId == null) {
            throw new InvalidCustomerInvoiceDraftException("clientId is required");
        }
        return clientRepository.findByClientIdAndOrganizationOrganizationId(clientId, organizationId)
                .orElseThrow(() -> new ClientNotFoundException(clientId));
    }

    private String requireCurrencyCode(String value) {
        if (value == null || value.isBlank()) {
            throw new InvalidCustomerInvoiceDraftException("currencyCode is required");
        }
        String currencyCode = value.trim().toUpperCase(Locale.ROOT);
        try {
            Currency.getInstance(currencyCode);
            return currencyCode;
        } catch (IllegalArgumentException exception) {
            throw new InvalidCustomerInvoiceDraftException("currencyCode must be a valid ISO 4217 code");
        }
    }

    private void ensureCustomerDraft(Invoice invoice) {
        if (invoice.getClient() == null
                || !InvoiceStatusCode.BROUILLON.getCode().equals(invoice.getInvoiceStatus().getCode())) {
            throw new CustomerInvoiceDraftNotModifiableException(invoice.getInvoiceId());
        }
    }

    private String normalizeOptionalText(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private CustomerInvoiceDraftResponse toResponse(Invoice invoice) {
        return new CustomerInvoiceDraftResponse(
                invoice.getInvoiceId(),
                invoice.getClient().getClientId(),
                invoice.getClient().getName(),
                invoice.getInvoiceStatus().getCode(),
                invoice.getInvoiceNumber(),
                invoice.getCurrencyCode(),
                invoice.getInvoiceDate() == null ? null : invoice.getInvoiceDate().toString(),
                invoice.getDueDate() == null ? null : invoice.getDueDate().toString(),
                invoice.getCommandReference(),
                invoice.getDescription()
        );
    }
}
