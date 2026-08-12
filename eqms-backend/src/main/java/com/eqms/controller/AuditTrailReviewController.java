package com.eqms.controller;

import com.eqms.dto.audittrail.AuditTrailReviewDtos.CampaignCompleteRequest;
import com.eqms.dto.audittrail.AuditTrailReviewDtos.CampaignCreateRequest;
import com.eqms.dto.audittrail.AuditTrailReviewDtos.CampaignDetailResponse;
import com.eqms.dto.audittrail.AuditTrailReviewDtos.CampaignSummaryResponse;
import com.eqms.dto.audittrail.AuditTrailReviewDtos.ItemDecisionRequest;
import com.eqms.dto.audittrail.AuditTrailReviewDtos.ItemResponse;
import com.eqms.service.AuditTrailReviewService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/audit-trail/reviews")
public class AuditTrailReviewController {

    private final AuditTrailReviewService service;

    public AuditTrailReviewController(AuditTrailReviewService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<CampaignSummaryResponse>> list() {
        return ResponseEntity.ok(service.listCampaigns());
    }

    @GetMapping("/paged")
    public ResponseEntity<com.eqms.dto.user.PageResponse<CampaignSummaryResponse>> listPaged(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int limit,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDirection) {
        return ResponseEntity.ok(service.listCampaignsPaged(page, limit, search, status, sortBy, sortDirection));
    }

    @GetMapping("/{id}/summary")
    public ResponseEntity<CampaignSummaryResponse> getSummary(@PathVariable UUID id) {
        return ResponseEntity.ok(service.getCampaignSummary(id));
    }

    @GetMapping("/{id}/items/paged")
    public ResponseEntity<com.eqms.dto.user.PageResponse<ItemResponse>> listItemsPaged(
            @PathVariable UUID id,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int limit,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String decision,
            @RequestParam(defaultValue = "timestamp") String sortBy,
            @RequestParam(defaultValue = "asc") String sortDirection) {
        return ResponseEntity.ok(service.listCampaignItemsPaged(id, page, limit, search, decision, sortBy, sortDirection));
    }

    @GetMapping("/{id}")
    public ResponseEntity<CampaignDetailResponse> get(@PathVariable UUID id) {
        return ResponseEntity.ok(service.getCampaign(id));
    }

    @PostMapping
    public ResponseEntity<CampaignDetailResponse> create(@RequestBody CampaignCreateRequest request) {
        return ResponseEntity.ok(service.createCampaign(request));
    }

    @PutMapping("/{id}/items/{itemId}")
    public ResponseEntity<ItemResponse> decide(
            @PathVariable UUID id,
            @PathVariable UUID itemId,
            @RequestBody ItemDecisionRequest request) {
        return ResponseEntity.ok(service.decideItem(id, itemId, request));
    }

    @PostMapping("/{id}/complete")
    public ResponseEntity<CampaignDetailResponse> complete(
            @PathVariable UUID id,
            @RequestBody CampaignCompleteRequest request) {
        return ResponseEntity.ok(service.completeCampaign(id, request));
    }

    @PostMapping("/{id}/cancel")
    public ResponseEntity<CampaignDetailResponse> cancel(@PathVariable UUID id) {
        return ResponseEntity.ok(service.cancelCampaign(id));
    }
}
