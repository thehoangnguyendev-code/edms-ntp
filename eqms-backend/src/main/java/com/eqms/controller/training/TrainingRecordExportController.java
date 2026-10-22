package com.eqms.controller.training;

import com.eqms.auth.CurrentUserService;
import com.eqms.service.training.TrainingRecordExportBatchService;
import com.eqms.service.training.TrainingRecordExportService;
import com.eqms.service.training.TrainingRecordExportService.*;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

/** Export of the personal training record (APD.0014): prepare, approve, download. */
@RestController
@RequestMapping("/training/record-exports")
public class TrainingRecordExportController {
    private final TrainingRecordExportService exports;
    private final TrainingRecordExportBatchService batches;
    private final CurrentUserService users;

    public TrainingRecordExportController(TrainingRecordExportService exports, TrainingRecordExportBatchService batches, CurrentUserService users) {
        this.batches = batches;
        this.exports = exports;
        this.users = users;
    }

    @GetMapping
    public ResponseEntity<?> list(@RequestParam(required = false) UUID personId, @RequestParam(required = false) String status,
                                  @RequestParam(required = false) String sortBy, @RequestParam(required = false) String sortDirection,
                                  @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "10") int limit,
                                  @RequestParam Map<String, String> filters) {
        return ResponseEntity.ok(exports.list(users.requireCurrentUser(), personId, status, sortBy, sortDirection, page, limit, filters));
    }

    @GetMapping("/eligible-approvers")
    public ResponseEntity<?> eligible(@RequestParam UUID personId, @RequestParam(required = false) String search, @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "20") int limit) {
        return ResponseEntity.ok(exports.eligibleApprovers(users.requireCurrentUser(), personId, search, page, limit));
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody CreateRequest request) { return ResponseEntity.ok(exports.create(users.requireCurrentUser(), request)); }

    @PostMapping("/{id}/approve")
    public ResponseEntity<?> approve(@PathVariable UUID id, @RequestBody SignRequest request) { return ResponseEntity.ok(exports.approve(users.requireCurrentUser(), id, request)); }

    @PostMapping("/{id}/reject")
    public ResponseEntity<?> reject(@PathVariable UUID id, @RequestBody RejectRequest request) { return ResponseEntity.ok(exports.reject(users.requireCurrentUser(), id, request)); }

    @GetMapping("/{id}/download")
    public ResponseEntity<byte[]> download(@PathVariable UUID id) {
        Map<String, Object> file = exports.download(users.requireCurrentUser(), id);
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_PDF).cacheControl(CacheControl.noStore())
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename((String) file.get("name")).build().toString()).body((byte[]) file.get("bytes"));
    }

    // ------------------------------------------------------------------------------------------------------------------------------ batches (a department and a year)

    @GetMapping("/batches")
    public ResponseEntity<?> batches(@RequestParam(required = false) String status, @RequestParam(required = false) String sortBy, @RequestParam(required = false) String sortDirection,
                                  @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "10") int limit, @RequestParam Map<String, String> filters) {
        return ResponseEntity.ok(batches.list(users.requireCurrentUser(), status, sortBy, sortDirection, page, limit, filters));
    }

    @GetMapping("/batches/preview")
    public ResponseEntity<?> batchPreview(@RequestParam UUID departmentId, @RequestParam int year) { return ResponseEntity.ok(batches.preview(users.requireCurrentUser(), departmentId, year)); }

    @GetMapping("/batches/eligible-approvers")
    public ResponseEntity<?> batchApprovers(@RequestParam UUID departmentId, @RequestParam(required = false) String search, @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "20") int limit) {
        return ResponseEntity.ok(batches.eligibleApprovers(users.requireCurrentUser(), departmentId, search, page, limit));
    }

    @PostMapping("/batches")
    public ResponseEntity<?> createBatch(@RequestBody TrainingRecordExportBatchService.CreateRequest request) { return ResponseEntity.ok(batches.create(users.requireCurrentUser(), request)); }

    @PostMapping("/batches/{id}/approve")
    public ResponseEntity<?> approveBatch(@PathVariable UUID id, @RequestBody TrainingRecordExportBatchService.SignRequest request) { return ResponseEntity.ok(batches.approve(users.requireCurrentUser(), id, request)); }

    @PostMapping("/batches/{id}/reject")
    public ResponseEntity<?> rejectBatch(@PathVariable UUID id, @RequestBody TrainingRecordExportBatchService.RejectRequest request) { return ResponseEntity.ok(batches.reject(users.requireCurrentUser(), id, request)); }

    @GetMapping("/batches/{id}/download")
    public ResponseEntity<byte[]> downloadBatch(@PathVariable UUID id) {
        Map<String, Object> file = batches.download(users.requireCurrentUser(), id);
        return ResponseEntity.ok().contentType(MediaType.parseMediaType("application/zip")).cacheControl(CacheControl.noStore())
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename((String) file.get("name")).build().toString()).body((byte[]) file.get("bytes"));
    }
}
