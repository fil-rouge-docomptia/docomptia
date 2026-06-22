package org.facturation.backend.service.impl;

import org.facturation.backend.model.Invoice;
import org.facturation.backend.repository.InvoiceRepository;
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
class InvoiceServiceImplTest {

    @Mock
    private InvoiceRepository invoiceRepository;

    @InjectMocks
    private InvoiceServiceImpl invoiceService;

    @Test
    void findAllReturnsInvoicesFromRepository() {
        Invoice invoice = new Invoice();
        when(invoiceRepository.findAll()).thenReturn(List.of(invoice));

        List<Invoice> invoices = invoiceService.findAll();

        assertEquals(1, invoices.size());
        assertSame(invoice, invoices.get(0));
        verify(invoiceRepository).findAll();
    }

    @Test
    void findByIdReturnsInvoiceFromRepository() {
        Invoice invoice = new Invoice();
        when(invoiceRepository.findById(1L)).thenReturn(Optional.of(invoice));

        Optional<Invoice> result = invoiceService.findById(1L);

        assertSame(invoice, result.orElseThrow());
        verify(invoiceRepository).findById(1L);
    }

    @Test
    void saveDelegatesToRepository() {
        Invoice invoice = new Invoice();
        when(invoiceRepository.save(invoice)).thenReturn(invoice);

        Invoice savedInvoice = invoiceService.save(invoice);

        assertSame(invoice, savedInvoice);
        verify(invoiceRepository).save(invoice);
    }
}
