package com.eqms.controller.training;

import com.eqms.auth.CurrentUserService;
import com.eqms.service.training.TrainingVendorService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/** The register of approved training vendors (SOP.0025). */
@RestController
@RequestMapping("/training/vendors")
public class TrainingVendorController {
    private final TrainingVendorService vendors;
    private final CurrentUserService users;

    public TrainingVendorController(TrainingVendorService vendors, CurrentUserService users) {
        this.vendors = vendors;
        this.users = users;
    }

    @GetMapping
    public ResponseEntity<?> page(@RequestParam(required = false) String search, @RequestParam(required = false) String status, @RequestParam(required = false) String approvedBy,
                                  @RequestParam(required = false) String approvedFrom, @RequestParam(required = false) String approvedTo, @RequestParam(required = false) String validFrom,
                                  @RequestParam(required = false) String validTo, @RequestParam(required = false) String reference, @RequestParam(required = false) String withoutEnd,
                                  @RequestParam(required = false) String sortBy, @RequestParam(defaultValue = "asc") String sortDirection, @RequestParam(defaultValue = "1") int page,
                                  @RequestParam(defaultValue = "10") int limit) {
        return ResponseEntity.ok(vendors.page(users.requireCurrentUser(), new TrainingVendorService.Filters(search, status, approvedBy, approvedFrom, approvedTo, validFrom, validTo, reference, withoutEnd),
                sortBy, sortDirection, page, limit));
    }

    @GetMapping("/approvers")
    public ResponseEntity<?> approvers() {
        return ResponseEntity.ok(vendors.approvers(users.requireCurrentUser()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> detail(@PathVariable UUID id) {
        return ResponseEntity.ok(vendors.detail(users.requireCurrentUser(), id));
    }

    /** Writes a vendor as a Draft. */
    @PostMapping
    public ResponseEntity<?> create(@RequestBody TrainingVendorService.SaveRequest request) {
        return ResponseEntity.ok(vendors.create(users.requireCurrentUser(), request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable UUID id, @RequestBody TrainingVendorService.SaveRequest request) {
        return ResponseEntity.ok(vendors.update(users.requireCurrentUser(), id, request));
    }

    @PostMapping("/{id}/approve")
    public ResponseEntity<?> approve(@PathVariable UUID id, @RequestBody TrainingVendorService.SignRequest request) {
        return ResponseEntity.ok(vendors.approve(users.requireCurrentUser(), id, request));
    }

    @PostMapping("/{id}/deactivate")
    public ResponseEntity<?> deactivate(@PathVariable UUID id, @RequestBody TrainingVendorService.ChangeRequest request) {
        return ResponseEntity.ok(vendors.deactivate(users.requireCurrentUser(), id, request));
    }

    @PostMapping("/{id}/activate")
    public ResponseEntity<?> activate(@PathVariable UUID id, @RequestBody TrainingVendorService.ChangeRequest request) {
        return ResponseEntity.ok(vendors.activate(users.requireCurrentUser(), id, request));
    }
}
