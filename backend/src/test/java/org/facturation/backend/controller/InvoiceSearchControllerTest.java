package org.facturation.backend.controller;

import org.facturation.backend.dto.response.InvoiceListItemResponse;
import org.facturation.backend.exception.ApiExceptionHandler;
import org.facturation.backend.mapper.OcrErrorMapper;
import org.facturation.backend.service.InvoiceHistoryService;
import org.facturation.backend.service.InvoiceService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class InvoiceSearchControllerTest {

    @Mock
    private InvoiceService invoiceService;

    @Mock
    private InvoiceHistoryService invoiceHistoryService;

    @Mock
    private OcrErrorMapper ocrErrorMapper;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        InvoiceController controller = new InvoiceController(invoiceService, invoiceHistoryService);
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new ApiExceptionHandler(ocrErrorMapper))
                .build();
    }

    @Test
    void returnsPaginationInformationAndRequestedSort() throws Exception {
        InvoiceListItemResponse invoice = new InvoiceListItemResponse();
        invoice.setInvoiceId(112L);
        invoice.setOrigin("MANUAL_UPLOAD");
        when(invoiceService.searchInvoices(
                eq(List.of("EXTRAITE", "VALIDEE")), eq("Orange"), eq("Docomptia"), eq("fac-2026"),
                isNull(), eq("2026-08-21"),
                eq("2026-07-01"), eq("2026-07-31"), eq("100.00"), eq("500.00"), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(invoice), PageRequest.of(1, 1), 3));

        mockMvc.perform(get("/api/v1/invoices")
                        .param("page", "1")
                        .param("size", "1")
                        .param("status", "EXTRAITE", "VALIDEE")
                        .param("supplier", "Orange")
                        .param("client", "Docomptia")
                        .param("invoiceNumber", "fac-2026")
                        .param("dueDate", "2026-08-21")
                        .param("startDate", "2026-07-01")
                        .param("endDate", "2026-07-31")
                        .param("minAmount", "100.00")
                        .param("maxAmount", "500.00")
                        .param("sortBy", "totalTtc")
                        .param("direction", "asc"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].invoiceId").value(112))
                .andExpect(jsonPath("$.content[0].origin").value("MANUAL_UPLOAD"))
                .andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.totalPages").value(3))
                .andExpect(jsonPath("$.number").value(1))
                .andExpect(jsonPath("$.size").value(1));

        ArgumentCaptor<Pageable> pageableCaptor = ArgumentCaptor.forClass(Pageable.class);
        verify(invoiceService).searchInvoices(
                eq(List.of("EXTRAITE", "VALIDEE")), eq("Orange"), eq("Docomptia"), eq("fac-2026"),
                isNull(), eq("2026-08-21"),
                eq("2026-07-01"), eq("2026-07-31"), eq("100.00"), eq("500.00"), pageableCaptor.capture());
        Pageable pageable = pageableCaptor.getValue();
        assertEquals(1, pageable.getPageNumber());
        assertEquals(1, pageable.getPageSize());
        assertEquals("ASC", pageable.getSort().getOrderFor("totalTtc").getDirection().name());
    }

    @Test
    void returnsPendingValidationInvoicesWithRequestedPaginationAndSort() throws Exception {
        InvoiceListItemResponse invoice = new InvoiceListItemResponse();
        invoice.setInvoiceId(144L);
        invoice.setStatus("A_VERIFIER");
        invoice.setOrigin("EMAIL");
        when(invoiceService.findPendingValidationInvoices(any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(invoice), PageRequest.of(1, 1), 3));

        mockMvc.perform(get("/api/v1/invoices/pending-validation")
                        .param("page", "1")
                        .param("size", "1")
                        .param("sortBy", "invoiceDate")
                        .param("direction", "asc"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].invoiceId").value(144))
                .andExpect(jsonPath("$.content[0].status").value("A_VERIFIER"))
                .andExpect(jsonPath("$.content[0].origin").value("EMAIL"))
                .andExpect(jsonPath("$.totalElements").value(3));

        ArgumentCaptor<Pageable> pageableCaptor = ArgumentCaptor.forClass(Pageable.class);
        verify(invoiceService).findPendingValidationInvoices(pageableCaptor.capture());
        Pageable pageable = pageableCaptor.getValue();
        assertEquals(1, pageable.getPageNumber());
        assertEquals(1, pageable.getPageSize());
        assertEquals("ASC", pageable.getSort().getOrderFor("invoiceDate").getDirection().name());
    }

    @Test
    void pendingValidationListRejectsFiltersThatCouldChangeItsStatusScope() throws Exception {
        mockMvc.perform(get("/api/v1/invoices/pending-validation").param("status", "VALIDEE"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message")
                        .value("Unsupported pending validation parameters: status"));

        verify(invoiceService, never()).findPendingValidationInvoices(any(Pageable.class));
    }

    @Test
    void returnsInvoicesAssignedToCurrentUserWithStatusFilterAndPagination() throws Exception {
        InvoiceListItemResponse invoice = new InvoiceListItemResponse();
        invoice.setInvoiceId(189L);
        invoice.setOrigin("APPROVED_PLATFORM");
        when(invoiceService.findInvoicesAssignedToCurrentUser(
                eq(List.of("EXTRAITE,A_VERIFIER")), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(invoice), PageRequest.of(1, 1), 2));

        mockMvc.perform(get("/api/v1/invoices/assigned-to-me")
                        .param("status", "EXTRAITE,A_VERIFIER")
                        .param("page", "1")
                        .param("size", "1")
                        .param("sortBy", "totalTtc")
                        .param("direction", "ASC"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].invoiceId").value(189))
                .andExpect(jsonPath("$.content[0].origin").value("APPROVED_PLATFORM"))
                .andExpect(jsonPath("$.totalElements").value(2));

        ArgumentCaptor<Pageable> pageableCaptor = ArgumentCaptor.forClass(Pageable.class);
        verify(invoiceService).findInvoicesAssignedToCurrentUser(
                eq(List.of("EXTRAITE,A_VERIFIER")), pageableCaptor.capture());
        Pageable pageable = pageableCaptor.getValue();
        assertEquals(1, pageable.getPageNumber());
        assertEquals(1, pageable.getPageSize());
        assertEquals("ASC", pageable.getSort().getOrderFor("totalTtc").getDirection().name());
    }

    @Test
    void assignedInvoiceListRejectsUnsupportedFilters() throws Exception {
        mockMvc.perform(get("/api/v1/invoices/assigned-to-me").param("supplier", "Orange"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Unsupported assigned invoice parameters: supplier"));

        verify(invoiceService, never()).findInvoicesAssignedToCurrentUser(any(), any(Pageable.class));
    }

    @Test
    void rejectsInvalidPaginationValues() throws Exception {
        mockMvc.perform(get("/api/v1/invoices").param("page", "-1"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("page must be greater than or equal to zero"));

        mockMvc.perform(get("/api/v1/invoices").param("size", "0"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("size must be greater than zero"));

        mockMvc.perform(get("/api/v1/invoices").param("page", "not-a-number"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("page must be an integer"));

        verify(invoiceService, never()).searchInvoices(
                isNull(), isNull(), isNull(), isNull(), isNull(), isNull(), isNull(), isNull(),
                isNull(), isNull(), any(Pageable.class));
    }

    @Test
    void rejectsInvalidSortValues() throws Exception {
        mockMvc.perform(get("/api/v1/invoices").param("sortBy", "supplier"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Invalid invoice sort field: supplier"));

        mockMvc.perform(get("/api/v1/invoices").param("direction", "sideways"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Invalid invoice sort direction"));

        verify(invoiceService, never()).searchInvoices(
                isNull(), isNull(), isNull(), isNull(), isNull(), isNull(), isNull(), isNull(),
                isNull(), isNull(), any(Pageable.class));
    }
}
