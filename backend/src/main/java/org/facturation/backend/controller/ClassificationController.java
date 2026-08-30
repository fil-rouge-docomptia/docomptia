package org.facturation.backend.controller;

import org.facturation.backend.dto.request.ClassificationCreateRequest;
import org.facturation.backend.dto.request.ClassificationUpdateRequest;
import org.facturation.backend.dto.response.ClassificationResponse;
import org.facturation.backend.service.ClassificationService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/classifications")
public class ClassificationController {
    private final ClassificationService service;
    public ClassificationController(ClassificationService service) { this.service = service; }

    @GetMapping
    public ResponseEntity<Page<ClassificationResponse>> list(@RequestParam(required = false) String type,
                                                              @RequestParam(defaultValue = "0") int page,
                                                              @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(service.findPage(type, PageRequest.of(page, size,
                Sort.by("type").ascending().and(Sort.by("name").ascending()))));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ClassificationResponse> get(@PathVariable Long id) {
        return ResponseEntity.ok(service.findDetailsById(id));
    }

    @PostMapping
    public ResponseEntity<ClassificationResponse> create(@RequestBody ClassificationCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(request));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<ClassificationResponse> update(@PathVariable Long id,
                                                         @RequestBody ClassificationUpdateRequest request) {
        return ResponseEntity.ok(service.update(id, request));
    }

    @PostMapping("/{id}/deactivate")
    public ResponseEntity<ClassificationResponse> deactivate(@PathVariable Long id) {
        return ResponseEntity.ok(service.deactivate(id));
    }
}
