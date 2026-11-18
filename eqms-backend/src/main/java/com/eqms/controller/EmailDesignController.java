package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.entity.EmailDesign;
import com.eqms.service.PermissionEvaluationService;
import com.eqms.service.EmailDesignService;
import com.eqms.util.EmailFrameRenderer;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/** The shared email design of the system: read it, change it, and see a sample mail in it. */
@RestController
@RequestMapping("/settings/email-design")
public class EmailDesignController {

    /** The colours and alignments are optional in a request: a client that does not send them keeps the look every email had before. */
    public record DesignBody(String logoUrl, String logoText, String brandColor, String buttonColor, String bodyColor, String footerColor, String logoAlign, String footerAlign,
                             String headerTextColor, String headerFontFamily, String bodyTextColor, String footerTextColor,
                             String fontFamily, String footerText, String supportEmail, Integer expectedVersion) {
        EmailDesignService.Change toChange() {
            return new EmailDesignService.Change(logoUrl, logoText, brandColor, buttonColor == null ? brandColor : buttonColor, bodyColor == null ? "#FFFFFF" : bodyColor, footerColor == null ? "#F8FAFC" : footerColor,
                    logoAlign == null ? "LEFT" : logoAlign, footerAlign == null ? "LEFT" : footerAlign,
                    headerTextColor == null ? "#FFFFFF" : headerTextColor, headerFontFamily, bodyTextColor == null ? "#334155" : bodyTextColor,
                    footerTextColor == null ? "#6B7280" : footerTextColor, fontFamily, footerText, supportEmail);
        }
    }

    public record DesignResponse(String logoUrl, String logoText, String brandColor, String buttonColor, String bodyColor, String footerColor, String logoAlign, String footerAlign,
                                 String headerTextColor, String headerFontFamily, String bodyTextColor, String footerTextColor, String fontFamily, String footerText, String supportEmail, int version, String updatedBy, Instant updatedAt,
                                 List<String> fonts, String headerTitle) {
    }

    public record PreviewResponse(String html) {
    }

    private final EmailDesignService service;
    private final CurrentUserService currentUserService;
    private final PermissionEvaluationService permissions;

    public EmailDesignController(EmailDesignService service, CurrentUserService currentUserService, PermissionEvaluationService permissions) {
        this.service = service;
        this.currentUserService = currentUserService;
        this.permissions = permissions;
    }

    @GetMapping
    public ResponseEntity<DesignResponse> get() {
        requireView();
        return ResponseEntity.ok(toResponse(service.current()));
    }

    @PutMapping
    public ResponseEntity<DesignResponse> update(@RequestBody DesignBody body) {
        requireManage();
        return ResponseEntity.ok(toResponse(service.update(body.toChange(), body.expectedVersion())));
    }

    /** A sample mail in the design being edited (not yet saved), so the person sees the result before saving. */
    @PostMapping("/preview")
    public ResponseEntity<PreviewResponse> preview(@RequestBody DesignBody body) {
        requireView();
        EmailDesignService.Change change = body.toChange();
        EmailDesignService.validate(change);
        EmailDesign draft = new EmailDesign();
        draft.setLogoUrl(change.logoUrl());
        draft.setLogoText(change.logoText());
        draft.setBrandColor(change.brandColor());
        draft.setButtonColor(change.buttonColor());
        draft.setBodyColor(change.bodyColor());
        draft.setFooterColor(change.footerColor());
        draft.setLogoAlign(change.logoAlign());
        draft.setFooterAlign(change.footerAlign());
        draft.setHeaderTextColor(change.headerTextColor());
        draft.setHeaderFontFamily(change.headerFontFamily());
        draft.setBodyTextColor(change.bodyTextColor());
        draft.setFooterTextColor(change.footerTextColor());
        draft.setFontFamily(change.fontFamily());
        draft.setFooterText(change.footerText());
        draft.setSupportEmail(change.supportEmail());
        String content = "<h2>Action needed: return controlled copy CC-0042-007</h2>"
                + EmailFrameRenderer.paragraphs("Dear Nguyen Van A,\n\nThe controlled copy CC-0042-007 has been recalled because the SOP was revised. "
                + "Please return the paper copy to Document Control by 20/11/2026.")
                + EmailFrameRenderer.button("Open the recall", "https://eqms.example/controlled-copies/42", change.buttonColor());
        return ResponseEntity.ok(new PreviewResponse(EmailFrameRenderer.render(draft, content, service.headerTitle(), true)));
    }

    private DesignResponse toResponse(EmailDesign d) {
        return new DesignResponse(d.getLogoUrl(), d.getLogoText(), d.getBrandColor(), d.getButtonColor(), d.getBodyColor(), d.getFooterColor(), d.getLogoAlign(), d.getFooterAlign(),
                d.getHeaderTextColor(), d.getHeaderFontFamily(), d.getBodyTextColor(), d.getFooterTextColor(), d.getFontFamily(), d.getFooterText(), d.getSupportEmail(), d.getVersion(), d.getUpdatedBy(), d.getUpdatedAt(),
                EmailFrameRenderer.SAFE_FONTS, service.headerTitle());
    }

    private void requireView() {
        var user = currentUserService.requireCurrentUser();
        if (!permissions.hasAnyPermission(user, "settings.notification_policy.view", "settings.notification_policy.manage",
                "settings.email_template.view", "settings.email_template.manage")) {
            throw new AccessDeniedException("Current user is not allowed to view the email design");
        }
    }

    private void requireManage() {
        var user = currentUserService.requireCurrentUser();
        if (!permissions.hasAnyPermission(user, "settings.notification_policy.manage", "settings.email_template.manage")) {
            throw new AccessDeniedException("Current user is not allowed to change the email design");
        }
    }
}
