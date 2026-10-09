package com.eqms.backup.agent.api;

import com.eqms.backup.agent.export.ExportException;
import com.eqms.backup.agent.export.ExportService;
import com.eqms.backup.agent.export.MediaService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Export Backup Set and the Offline Media Register. The backend has checked the person and the permission; the agent enforces the rest. */
@RestController
@RequestMapping("/internal")
public class InternalExportController {

    public record RegisterRequest(String label, String serialNumber, String kind, Long capacityBytes, String exportDir, String expiresOn, String by) {
    }

    public record HandoverRequest(String holder, String location, String by) {
    }

    public record ByRequest(String by) {
    }

    public record ReadTestRequest(String result, String detail, String by) {
    }

    public record RecycleRequest(Boolean wipeConfirmed, String reason, String by) {
    }

    public record RetireRequest(String destructionRecord, String by) {
    }

    public record ExportRequest(UUID mediaId, String reason, String by) {
    }

    public record DecisionRequest(String reason, String by) {
    }

    private final MediaService media;
    private final ExportService exports;

    public InternalExportController(MediaService media, ExportService exports) {
        this.media = media;
        this.exports = exports;
    }

    // ------------------------------------------------------------------ media

    @GetMapping("/media")
    public Map<String, Object> mediaList(@RequestParam(required = false) String search, @RequestParam(required = false) String status, @RequestParam(required = false) String kind,
                                         @RequestParam(defaultValue = "label") String sortBy, @RequestParam(defaultValue = "asc") String sortDirection,
                                         @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "10") int limit) {
        MediaService.Page result = media.page(search, status, kind, sortBy, !"desc".equalsIgnoreCase(sortDirection), page, limit);
        return paged(result.data(), result.page(), result.limit(), result.total());
    }

    @GetMapping("/media/{id}")
    public Map<String, Object> mediaGet(@PathVariable UUID id) {
        return media.get(id);
    }

    @GetMapping("/media/{id}/events")
    public List<Map<String, Object>> mediaEvents(@PathVariable UUID id) {
        return media.events(id);
    }

    @GetMapping("/media/{id}/packages")
    public List<Map<String, Object>> mediaPackages(@PathVariable UUID id) {
        return media.packages(id);
    }

    @PostMapping("/media")
    public ResponseEntity<Map<String, Object>> register(@RequestBody RegisterRequest r) {
        return ResponseEntity.status(HttpStatus.CREATED).body(media.register(new MediaService.Registration(r.label(), r.serialNumber(), r.kind(),
                r.capacityBytes() == null ? 0 : r.capacityBytes(), r.exportDir(), r.expiresOn(), r.by())));
    }

    @PostMapping("/media/{id}/handover")
    public Map<String, Object> handover(@PathVariable UUID id, @RequestBody HandoverRequest r) {
        return media.handover(id, r.holder(), r.location(), r.by());
    }

    @PostMapping("/media/{id}/receive")
    public Map<String, Object> receive(@PathVariable UUID id, @RequestBody ByRequest r) {
        return media.receive(id, r.by());
    }

    @PostMapping("/media/{id}/read-test")
    public Map<String, Object> readTest(@PathVariable UUID id, @RequestBody ReadTestRequest r) {
        return media.readTest(id, r.result(), r.detail(), r.by());
    }

    @PostMapping("/media/{id}/recycle")
    public Map<String, Object> recycle(@PathVariable UUID id, @RequestBody RecycleRequest r) {
        return media.recycle(id, Boolean.TRUE.equals(r.wipeConfirmed()), r.reason(), r.by());
    }

    @PostMapping("/media/{id}/retire")
    public Map<String, Object> retire(@PathVariable UUID id, @RequestBody RetireRequest r) {
        return media.retire(id, r.destructionRecord(), r.by());
    }

    // ------------------------------------------------------------------ exports

    @GetMapping("/exports")
    public Map<String, Object> exportList(@RequestParam(required = false) String search, @RequestParam(required = false) String status, @RequestParam(required = false) String backupId,
                                          @RequestParam(defaultValue = "requestedAt") String sortBy, @RequestParam(defaultValue = "desc") String sortDirection,
                                          @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "10") int limit) {
        ExportService.Page result = exports.page(search, status, backupId, sortBy, "asc".equalsIgnoreCase(sortDirection), page, limit);
        return paged(result.data(), result.page(), result.limit(), result.total());
    }

    @GetMapping("/exports/{exportId}")
    public Map<String, Object> exportGet(@PathVariable String exportId) {
        return exports.get(exportId);
    }

    @GetMapping("/backups/{backupId}/export-estimate")
    public Map<String, Object> estimate(@PathVariable String backupId) {
        return exports.estimate(backupId);
    }

    @PostMapping("/backups/{backupId}/exports")
    public ResponseEntity<Map<String, Object>> request(@PathVariable String backupId, @RequestBody ExportRequest r) {
        return ResponseEntity.status(HttpStatus.CREATED).body(exports.request(backupId, r.mediaId(), r.reason(), r.by()));
    }

    @PostMapping("/exports/{exportId}/approve")
    public Map<String, Object> approve(@PathVariable String exportId, @RequestBody ByRequest r) {
        return exports.approve(exportId, r.by());
    }

    @PostMapping("/exports/{exportId}/reject")
    public Map<String, Object> reject(@PathVariable String exportId, @RequestBody DecisionRequest r) {
        return exports.reject(exportId, r.by(), r.reason());
    }

    private static Map<String, Object> paged(List<Map<String, Object>> data, int page, int limit, long total) {
        Map<String, Object> pagination = new LinkedHashMap<>();
        pagination.put("page", page);
        pagination.put("limit", limit);
        pagination.put("total", total);
        pagination.put("totalPages", Math.max(1, (int) Math.ceil(total / (double) limit)));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("data", data);
        out.put("pagination", pagination);
        return out;
    }

    @ExceptionHandler(ExportException.class)
    public ResponseEntity<Map<String, Object>> refused(ExportException e) {
        HttpStatus status = switch (e.kind) {
            case NOT_FOUND -> HttpStatus.NOT_FOUND;
            case CONFLICT, SEPARATION -> HttpStatus.CONFLICT;
            case INVALID -> HttpStatus.BAD_REQUEST;
        };
        return ResponseEntity.status(status).body(Map.of("code", e.code, "message", e.getMessage()));
    }
}
