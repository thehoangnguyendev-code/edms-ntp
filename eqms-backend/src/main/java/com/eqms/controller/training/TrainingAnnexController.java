package com.eqms.controller.training;

import com.eqms.auth.CurrentUserService;
import com.eqms.service.training.TrainingAnnexService;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

/** The Training Annex: the forms of Training (APD annexes), their contract, signature styles and previews. Templates are uploaded, enabled and disabled through /training/form-templates. */
@RestController
@RequestMapping("/training/annex")
public class TrainingAnnexController {
    private final TrainingAnnexService annex;
    private final CurrentUserService users;

    public TrainingAnnexController(TrainingAnnexService annex, CurrentUserService users) {
        this.annex = annex;
        this.users = users;
    }

    @GetMapping
    public ResponseEntity<?> page(@RequestParam(required = false) String search, @RequestParam(required = false) String status, @RequestParam(required = false) String sortBy,
                                  @RequestParam(defaultValue = "asc") String sortDirection, @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "10") int limit) {
        return ResponseEntity.ok(annex.page(users.requireCurrentUser(), search, status, sortBy, sortDirection, page, limit));
    }

    @GetMapping("/{code}")
    public ResponseEntity<?> detail(@PathVariable String code) { return ResponseEntity.ok(annex.detail(users.requireCurrentUser(), code)); }

    @GetMapping("/{code}/starter")
    public ResponseEntity<byte[]> starter(@PathVariable String code) { return file(annex.starter(users.requireCurrentUser(), code), true); }

    @PutMapping("/{code}/slots/{slot}/style")
    public ResponseEntity<?> style(@PathVariable String code, @PathVariable String slot, @RequestBody TrainingAnnexService.StyleRequest request) {
        return ResponseEntity.ok(annex.setStyle(users.requireCurrentUser(), code, slot, request));
    }

    @GetMapping("/templates/{id}/preview")
    public ResponseEntity<byte[]> preview(@PathVariable UUID id) { return file(annex.preview(users.requireCurrentUser(), id), false); }

    private static ResponseEntity<byte[]> file(Map<String, Object> f, boolean attachment) {
        ContentDisposition disposition = (attachment ? ContentDisposition.attachment() : ContentDisposition.inline()).filename((String) f.get("name")).build();
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(String.valueOf(f.get("contentType")))).cacheControl(CacheControl.noStore())
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString()).body((byte[]) f.get("bytes"));
    }
}
