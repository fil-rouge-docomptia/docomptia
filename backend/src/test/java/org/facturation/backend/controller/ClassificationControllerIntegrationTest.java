package org.facturation.backend.controller;

import org.facturation.backend.exception.ApiExceptionHandler;
import org.facturation.backend.model.*;
import org.facturation.backend.repository.ClassificationRepository;
import org.facturation.backend.repository.InvoiceRepository;
import org.facturation.backend.repository.InvoiceStatusRepository;
import org.facturation.backend.repository.OrganizationRepository;
import org.facturation.backend.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@Transactional
@org.springframework.security.test.context.support.WithMockUser(username = "admin@facturation-demo.fr")
class ClassificationControllerIntegrationTest {
    private final MockMvc classificationMvc;
    private final MockMvc invoiceMvc;
    private final ClassificationRepository classificationRepository;
    private final InvoiceRepository invoiceRepository;
    private final OrganizationRepository organizationRepository;
    private final UserRepository userRepository;
    private final InvoiceStatusRepository invoiceStatusRepository;

    @Autowired
    ClassificationControllerIntegrationTest(ClassificationController classificationController,
                                            InvoiceController invoiceController,
                                            ApiExceptionHandler handler,
                                            ClassificationRepository classificationRepository,
                                            InvoiceRepository invoiceRepository,
                                            OrganizationRepository organizationRepository,
                                            UserRepository userRepository,
                                            InvoiceStatusRepository invoiceStatusRepository) {
        this.classificationMvc = MockMvcBuilders.standaloneSetup(classificationController).setControllerAdvice(handler).build();
        this.invoiceMvc = MockMvcBuilders.standaloneSetup(invoiceController).setControllerAdvice(handler).build();
        this.classificationRepository = classificationRepository;
        this.invoiceRepository = invoiceRepository;
        this.organizationRepository = organizationRepository;
        this.userRepository = userRepository;
        this.invoiceStatusRepository = invoiceStatusRepository;
    }

    @Test
    void createsListsUpdatesAndDeactivatesClassification() throws Exception {
        String location = classificationMvc.perform(post("/api/v1/classifications")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"CHANTIER\",\"name\":\" Site Atlas \","
                                + "\"description\":\"Construction\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.type").value("CHANTIER"))
                .andExpect(jsonPath("$.name").value("Site Atlas"))
                .andExpect(jsonPath("$.active").value(true))
                .andReturn().getResponse().getContentAsString();
        Long id = Long.valueOf(location.replaceAll(".*\"classificationId\":(\\d+).*", "$1"));

        classificationMvc.perform(get("/api/v1/classifications").param("type", "chantier"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1));
        classificationMvc.perform(patch("/api/v1/classifications/{id}", id)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Site Atlas II\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.name").value("Site Atlas II"));
        classificationMvc.perform(post("/api/v1/classifications/{id}/deactivate", id))
                .andExpect(status().isOk()).andExpect(jsonPath("$.active").value(false));
        assertFalse(classificationRepository.findById(id).orElseThrow().isActive());
    }

    @Test
    void isolatesClassificationsByOrganization() throws Exception {
        Classification hidden = classification(createOrganization(), ClassificationType.DOSSIER, "Secret");
        classificationMvc.perform(get("/api/v1/classifications/{id}", hidden.getClassificationId()))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("CLASSIFICATION_NOT_FOUND"));
    }

    @Test
    void assignsOnlyActiveClassificationAndKeepsHistoricalAssignmentAfterDeactivation() throws Exception {
        Organization organization = organizationRepository.findById(1L).orElseThrow();
        Classification active = classification(organization, ClassificationType.CLASSEUR, "Achats 2026");
        Invoice invoice = invoice(organization);

        invoiceMvc.perform(patch("/api/v1/invoices/{id}/classification", invoice.getInvoiceId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"classificationId\":" + active.getClassificationId() + "}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.classification.name").value("Achats 2026"));

        classificationMvc.perform(post("/api/v1/classifications/{id}/deactivate", active.getClassificationId()))
                .andExpect(status().isOk());
        assertEquals(active.getClassificationId(), invoiceRepository.findById(invoice.getInvoiceId())
                .orElseThrow().getClassification().getClassificationId());

        Invoice secondInvoice = invoice(organization);
        invoiceMvc.perform(patch("/api/v1/invoices/{id}/classification", secondInvoice.getInvoiceId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"classificationId\":" + active.getClassificationId() + "}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CLASSIFICATION_VALIDATION_ERROR"));
    }

    private Classification classification(Organization organization, ClassificationType type, String name) {
        Classification value = new Classification();
        value.setOrganization(organization); value.setType(type); value.setName(name); value.setActive(true);
        value.setCreatedAt(LocalDateTime.now()); value.setUpdatedAt(LocalDateTime.now());
        return classificationRepository.save(value);
    }

    private Invoice invoice(Organization organization) {
        Invoice invoice = new Invoice();
        invoice.setOrganization(organization);
        invoice.setCreatedByUser(userRepository.findById(1L).orElseThrow());
        invoice.setInvoiceStatus(invoiceStatusRepository.findByCode("EXTRAITE").orElseThrow());
        invoice.setCurrencyCode("EUR"); invoice.setCreatedAt(LocalDateTime.now()); invoice.setUpdatedAt(LocalDateTime.now());
        return invoiceRepository.save(invoice);
    }

    private Organization createOrganization() {
        Organization organization = new Organization();
        organization.setName("Other"); organization.setLegalName("Other SAS");
        organization.setSiret(String.format("%014d", Math.floorMod(System.nanoTime(), 100_000_000_000_000L)));
        organization.setEmail("other@example.com"); organization.setCreatedAt(LocalDateTime.now());
        organization.setUpdatedAt(LocalDateTime.now());
        return organizationRepository.save(organization);
    }
}
