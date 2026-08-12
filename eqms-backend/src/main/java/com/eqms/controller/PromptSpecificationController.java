package com.eqms.controller;

import com.eqms.dto.CreatePromptGenerationRunRequest;
import com.eqms.dto.CreatePromptSpecificationRequest;
import com.eqms.dto.PromptGenerationRunResponse;
import com.eqms.dto.PromptSpecificationResponse;
import com.eqms.dto.PromptSpecificationSummaryResponse;
import com.eqms.service.PromptSpecificationService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/prompt-specs")
public class PromptSpecificationController {

    private final PromptSpecificationService promptSpecificationService;

    public PromptSpecificationController(PromptSpecificationService promptSpecificationService) {
        this.promptSpecificationService = promptSpecificationService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PromptSpecificationResponse create(@Valid @RequestBody CreatePromptSpecificationRequest request) {
        return promptSpecificationService.create(request);
    }

    @GetMapping
    public List<PromptSpecificationSummaryResponse> list() {
        return promptSpecificationService.list();
    }

    @GetMapping("/{id}")
    public PromptSpecificationResponse getById(@PathVariable UUID id) {
        return promptSpecificationService.getById(id);
    }

    @PostMapping("/{id}/runs")
    @ResponseStatus(HttpStatus.CREATED)
    public PromptGenerationRunResponse createRun(
            @PathVariable UUID id,
            @Valid @RequestBody CreatePromptGenerationRunRequest request
    ) {
        return promptSpecificationService.createRun(id, request);
    }
}
