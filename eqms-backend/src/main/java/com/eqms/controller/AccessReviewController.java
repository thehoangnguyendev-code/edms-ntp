package com.eqms.controller;

import com.eqms.dto.user.AccessReviewDtos.CampaignCompleteRequest;
import com.eqms.dto.user.AccessReviewDtos.CampaignCreateRequest;
import com.eqms.dto.user.AccessReviewDtos.CampaignDetailResponse;
import com.eqms.dto.user.AccessReviewDtos.CampaignSummaryResponse;
import com.eqms.dto.user.AccessReviewDtos.CodeLabelResponse;
import com.eqms.dto.user.AccessReviewDtos.ItemDecisionRequest;
import com.eqms.dto.user.AccessReviewDtos.ItemResponse;
import com.eqms.service.AccessReviewService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping({"/security/access-reviews", "/settings/access-reviews"})
public class AccessReviewController {

    private final AccessReviewService service;

    public AccessReviewController(AccessReviewService service) {
        this.service = service;
    }

    @GetMapping("/paged")
    public ResponseEntity<com.eqms.dto.user.PageResponse<com.eqms.dto.user.AccessReviewDtos.CampaignSummaryResponse>> listPaged(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int limit,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String createdFrom,
            @RequestParam(required = false) String createdTo,
            @RequestParam(required = false) String updatedFrom,
            @RequestParam(required = false) String updatedTo,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir) {
        return ResponseEntity.ok(service.listPaged(page, limit, search, status,
                createdFrom, createdTo, updatedFrom, updatedTo, sortBy, sortDir));
    }

    @GetMapping("/list-options")
    public ResponseEntity<java.util.Map<String, java.util.List<CodeLabelResponse>>> getListOptions() {
        return ResponseEntity.ok(service.getListOptions());
    }

    @GetMapping
    public ResponseEntity<List<CampaignSummaryResponse>> list() {
        return ResponseEntity.ok(service.listCampaigns());
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
            @RequestParam(required = false) String userStatus,
            @RequestParam(required = false) String decision,
            @RequestParam(defaultValue = "username") String sortBy,
            @RequestParam(defaultValue = "asc") String sortDir) {
        return ResponseEntity.ok(service.listItemsPaged(id, page, limit, search, userStatus, decision, sortBy, sortDir));
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
