package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.audittrail.AuditTrailChangeResponse;
import com.eqms.entity.EmailDesign;
import com.eqms.entity.UserAccount;
import com.eqms.repository.EmailDesignRepository;
import com.eqms.util.EmailFrameRenderer;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/**
 * The shared look of every email (owner decision D2). Reading never fails: with no row the defaults of the frame are used, so a mail is
 * never refused for want of a design. Changing it is validated and written to the Audit Trail with the value before and after.
 */
@Service
public class EmailDesignService {

    /** A logo is a web address or a small inline picture; anything else (a script, a file path) is refused. */
    static final int MAX_LOGO_LENGTH = 400_000;

    private final EmailDesignRepository repository;
    private final AuditTrailService auditTrailService;
    private final CurrentUserService currentUserService;
    /** Looked up when needed: the configuration service reaches the mail services, which reach this one. */
    private final ObjectProvider<SystemConfigurationService> configuration;

    public EmailDesignService(EmailDesignRepository repository, AuditTrailService auditTrailService, CurrentUserService currentUserService,
                              ObjectProvider<SystemConfigurationService> configuration) {
        this.repository = repository;
        this.auditTrailService = auditTrailService;
        this.currentUserService = currentUserService;
        this.configuration = configuration;
    }

    /**
     * What the header says when the design has no logo: the Header Title (Dashboard) of the general configuration, read from the database;
     * when that is not set, the display name of the system; when that is not set either, EQMS.
     */
    public String headerTitle() {
        try {
            SystemConfigurationService service = configuration.getIfAvailable();
            var branding = service == null ? null : service.getPublicBranding();
            String title = branding == null ? null : branding.systemHeaderTitle();
            if (title == null || title.isBlank()) title = branding == null ? null : branding.systemDisplayName();
            return title == null || title.isBlank() ? DEFAULT_HEADER_TITLE : title.strip();
        } catch (RuntimeException e) {
            return DEFAULT_HEADER_TITLE;
        }
    }

    /** The text of the header when there is no logo and the configuration has neither a Header Title nor a display name. */
    static final String DEFAULT_HEADER_TITLE = "EQMS";

    public static final List<String> ALIGNMENTS = List.of("LEFT", "CENTER", "RIGHT");
    public static final List<String> BUTTON_SIZES = List.of("SMALL", "MEDIUM", "LARGE");

    public record Change(String logoUrl, String logoText, String brandColor, String buttonColor, String bodyColor, String footerColor, String logoAlign, String footerAlign,
                         String headerTextColor, String headerFontFamily, String bodyTextColor, String footerTextColor,
                         String fontFamily, String footerText, String supportEmail, String footerTextVi, String buttonSize, boolean showButtonLink) {

        /** Without a Vietnamese footer; the button has the medium size. */
        public Change(String logoUrl, String logoText, String brandColor, String buttonColor, String bodyColor, String footerColor, String logoAlign, String footerAlign,
                      String headerTextColor, String headerFontFamily, String bodyTextColor, String footerTextColor,
                      String fontFamily, String footerText, String supportEmail) {
            this(logoUrl, logoText, brandColor, buttonColor, bodyColor, footerColor, logoAlign, footerAlign, headerTextColor, headerFontFamily, bodyTextColor, footerTextColor, fontFamily, footerText, supportEmail, null, "MEDIUM", true);
        }

        /** Without a button colour: the button has the colour of the header. */
        public Change(String logoUrl, String logoText, String brandColor, String bodyColor, String footerColor, String logoAlign, String footerAlign,
                      String headerTextColor, String headerFontFamily, String bodyTextColor, String footerTextColor,
                      String fontFamily, String footerText, String supportEmail) {
            this(logoUrl, logoText, brandColor, brandColor, bodyColor, footerColor, logoAlign, footerAlign, headerTextColor, headerFontFamily, bodyTextColor, footerTextColor, fontFamily, footerText, supportEmail);
        }

        /** Without a logo text. */
        public Change(String logoUrl, String brandColor, String bodyColor, String footerColor, String logoAlign, String footerAlign,
                      String headerTextColor, String headerFontFamily, String bodyTextColor, String footerTextColor,
                      String fontFamily, String footerText, String supportEmail) {
            this(logoUrl, null, brandColor, brandColor, bodyColor, footerColor, logoAlign, footerAlign, headerTextColor, headerFontFamily, bodyTextColor, footerTextColor, fontFamily, footerText, supportEmail);
        }

        /** Without a header font: the words in the header use the font of the body. */
        public Change(String logoUrl, String brandColor, String bodyColor, String footerColor, String logoAlign, String footerAlign,
                      String headerTextColor, String bodyTextColor, String footerTextColor,
                      String fontFamily, String footerText, String supportEmail) {
            this(logoUrl, brandColor, bodyColor, footerColor, logoAlign, footerAlign, headerTextColor, null, bodyTextColor, footerTextColor, fontFamily, footerText, supportEmail);
        }

        /** Without text colours: the text colours every email had before they could be set. */
        public Change(String logoUrl, String brandColor, String bodyColor, String footerColor, String logoAlign, String footerAlign,
                      String fontFamily, String footerText, String supportEmail) {
            this(logoUrl, brandColor, bodyColor, footerColor, logoAlign, footerAlign, "#FFFFFF", "#334155", "#6B7280", fontFamily, footerText, supportEmail);
        }

        /** The look as it was before the body and footer colours and the alignment existed. */
        public Change(String logoUrl, String brandColor, String fontFamily, String footerText, String supportEmail) {
            this(logoUrl, brandColor, "#FFFFFF", "#F8FAFC", "LEFT", "LEFT", fontFamily, footerText, supportEmail);
        }
    }

    @Transactional(readOnly = true)
    public EmailDesign current() {
        return repository.findAll().stream().findFirst().orElseGet(EmailDesign::new);
    }

    /** Wraps content in the shared frame. */
    @Transactional(readOnly = true)
    public String frame(String contentHtml) {
        return EmailFrameRenderer.render(current(), contentHtml, headerTitle());
    }

    /** Wraps content in the shared frame for a preview on a screen: the card alone, without the grey page around it. */
    @Transactional(readOnly = true)
    public String framePreview(String contentHtml) {
        return EmailFrameRenderer.render(current(), contentHtml, headerTitle(), true);
    }

    @Transactional
    public EmailDesign update(Change change) {
        return update(change, null);
    }

    /** {@code expectedVersion} is the version of the design as the person saw it when they opened it; when another change was saved since, this one is refused. Empty skips the check. */
    @Transactional
    public EmailDesign update(Change change, Integer expectedVersion) {
        UserAccount actor = currentUserService.requireCurrentUser();
        validate(change);
        // a design is saved with a logo picture or a text for the header; a preview may still be made without either
        if (!StringUtils.hasText(change.logoUrl()) && !StringUtils.hasText(change.logoText())) {
            throw new IllegalArgumentException("The header needs a text or a logo: type a text or upload a picture");
        }
        EmailDesign design = repository.findAll().stream().findFirst().orElseGet(() -> {
            EmailDesign created = new EmailDesign();
            created.setId(UUID.randomUUID());
            return created;
        });
        if (expectedVersion != null && expectedVersion != design.getVersion()) {
            throw new IllegalStateException("This was changed by someone else after you opened it. Reload it to see their change, then make yours again.");
        }
        List<AuditTrailChangeResponse> changes = new ArrayList<>();
        diff(changes, "Logo", design.getLogoUrl() == null ? "" : "(set)", change.logoUrl() == null || change.logoUrl().isBlank() ? "" : "(set)",
                !Objects.equals(blankToNull(design.getLogoUrl()), blankToNull(change.logoUrl())));
        diff(changes, "Header colour", design.getBrandColor(), change.brandColor(), !Objects.equals(design.getBrandColor(), change.brandColor()));
        diff(changes, "Button colour", design.getButtonColor(), change.buttonColor(), !Objects.equals(design.getButtonColor(), change.buttonColor()));
        diff(changes, "Logo text", nz(design.getLogoText()), nz(change.logoText()), !Objects.equals(blankToNull(design.getLogoText()), blankToNull(change.logoText())));
        diff(changes, "Header font", nz(design.getHeaderFontFamily()), nz(change.headerFontFamily()), !Objects.equals(blankToNull(design.getHeaderFontFamily()), blankToNull(change.headerFontFamily())));
        diff(changes, "Header text colour", design.getHeaderTextColor(), change.headerTextColor(), !Objects.equals(design.getHeaderTextColor(), change.headerTextColor()));
        diff(changes, "Body text colour", design.getBodyTextColor(), change.bodyTextColor(), !Objects.equals(design.getBodyTextColor(), change.bodyTextColor()));
        diff(changes, "Footer text colour", design.getFooterTextColor(), change.footerTextColor(), !Objects.equals(design.getFooterTextColor(), change.footerTextColor()));
        diff(changes, "Body colour", design.getBodyColor(), change.bodyColor(), !Objects.equals(design.getBodyColor(), change.bodyColor()));
        diff(changes, "Footer colour", design.getFooterColor(), change.footerColor(), !Objects.equals(design.getFooterColor(), change.footerColor()));
        diff(changes, "Logo alignment", design.getLogoAlign(), change.logoAlign(), !Objects.equals(design.getLogoAlign(), change.logoAlign()));
        diff(changes, "Footer alignment", design.getFooterAlign(), change.footerAlign(), !Objects.equals(design.getFooterAlign(), change.footerAlign()));
        diff(changes, "Font", design.getFontFamily(), change.fontFamily(), !Objects.equals(design.getFontFamily(), change.fontFamily()));
        diff(changes, "Footer", nz(design.getFooterText()), nz(change.footerText()), !Objects.equals(nz(design.getFooterText()), nz(change.footerText())));
        diff(changes, "Button size", design.getButtonSize(), change.buttonSize(), !Objects.equals(design.getButtonSize(), change.buttonSize()));
        diff(changes, "Address under the button", design.isShowButtonLink() ? "Shown" : "Hidden", change.showButtonLink() ? "Shown" : "Hidden", design.isShowButtonLink() != change.showButtonLink());
        diff(changes, "Footer (Vietnamese)", nz(design.getFooterTextVi()), nz(change.footerTextVi()), !Objects.equals(nz(design.getFooterTextVi()), nz(change.footerTextVi())));
        diff(changes, "Support e-mail", nz(design.getSupportEmail()), nz(change.supportEmail()), !Objects.equals(nz(design.getSupportEmail()), nz(change.supportEmail())));
        if (changes.isEmpty()) {
            return design;
        }
        design.setLogoUrl(blankToNull(change.logoUrl()));
        design.setBrandColor(change.brandColor());
        design.setButtonColor(change.buttonColor());
        design.setLogoText(blankToNull(change.logoText()));
        design.setHeaderFontFamily(blankToNull(change.headerFontFamily()));
        design.setHeaderTextColor(change.headerTextColor());
        design.setBodyTextColor(change.bodyTextColor());
        design.setFooterTextColor(change.footerTextColor());
        design.setBodyColor(change.bodyColor());
        design.setFooterColor(change.footerColor());
        design.setLogoAlign(change.logoAlign());
        design.setFooterAlign(change.footerAlign());
        design.setFontFamily(change.fontFamily());
        design.setFooterText(blankToNull(change.footerText()));
        design.setFooterTextVi(blankToNull(change.footerTextVi()));
        design.setButtonSize(change.buttonSize());
        design.setShowButtonLink(change.showButtonLink());
        design.setSupportEmail(blankToNull(change.supportEmail()));
        design.setVersion(design.getVersion() + 1);
        design.setUpdatedBy(actor.getUsername());
        design.setUpdatedAt(Instant.now());
        EmailDesign saved = repository.save(design);
        auditTrailService.logAs(actor, "EMAIL_DESIGN", "Shared email design", saved.getId(), "UPDATE", null, null,
                "The shared email design was changed to version " + saved.getVersion(), changes);
        return saved;
    }

    public static void validate(Change change) {
        if (change == null) {
            throw new IllegalArgumentException("The email design is required");
        }
        if (change.brandColor() == null || !change.brandColor().matches("#[0-9a-fA-F]{6}")) {
            throw new IllegalArgumentException("The brand colour must be written as #RRGGBB");
        }
        for (String[] colour : new String[][] {{"body colour", change.bodyColor()}, {"footer colour", change.footerColor()}, {"button colour", change.buttonColor()},
                {"header text colour", change.headerTextColor()}, {"body text colour", change.bodyTextColor()}, {"footer text colour", change.footerTextColor()}}) {
            if (colour[1] == null || !colour[1].matches("#[0-9a-fA-F]{6}")) {
                throw new IllegalArgumentException("The " + colour[0] + " must be written as #RRGGBB");
            }
        }
        for (String[] align : new String[][] {{"logo", change.logoAlign()}, {"footer", change.footerAlign()}}) {
            if (align[1] == null || !ALIGNMENTS.contains(align[1])) {
                throw new IllegalArgumentException("The " + align[0] + " alignment must be one of: " + String.join(", ", ALIGNMENTS));
            }
        }
        if (StringUtils.hasText(change.headerFontFamily()) && EmailFrameRenderer.SAFE_FONTS.stream().noneMatch(f -> f.equalsIgnoreCase(change.headerFontFamily()))) {
            throw new IllegalArgumentException("The header font must be one of: " + String.join(", ", EmailFrameRenderer.SAFE_FONTS));
        }
        if (EmailFrameRenderer.SAFE_FONTS.stream().noneMatch(f -> f.equalsIgnoreCase(change.fontFamily()))) {
            throw new IllegalArgumentException("The font must be one of: " + String.join(", ", EmailFrameRenderer.SAFE_FONTS));
        }
        String text = change.logoText();
        if (text != null && (text.length() > 200 || text.chars().anyMatch(Character::isISOControl))) {
            throw new IllegalArgumentException("The header text must be one line of 200 characters or fewer");
        }
        String logo = change.logoUrl();
        if (StringUtils.hasText(logo)) {
            boolean web = logo.startsWith("https://") || logo.startsWith("http://");
            boolean inline = logo.matches("(?s)data:image/(png|jpeg|gif);base64,[A-Za-z0-9+/=]+");
            if (!web && !inline) {
                throw new IllegalArgumentException("The logo must be a web address or a PNG, JPEG or GIF picture");
            }
            if (logo.length() > MAX_LOGO_LENGTH) {
                throw new IllegalArgumentException("The logo is too large; use a picture under 250 KB");
            }
        }
        if (StringUtils.hasText(change.supportEmail()) && !change.supportEmail().matches("[^@\\s<>\"]+@[^@\\s<>\"]+\\.[^@\\s<>\"]+")) {
            throw new IllegalArgumentException("The support e-mail is not a valid address");
        }
        if (change.buttonSize() == null || !BUTTON_SIZES.contains(change.buttonSize())) {
            throw new IllegalArgumentException("The button size must be one of: " + String.join(", ", BUTTON_SIZES));
        }
        if (change.footerTextVi() != null && change.footerTextVi().length() > 500) {
            throw new IllegalArgumentException("The Vietnamese footer must be 500 characters or fewer");
        }
        if (change.footerText() != null && change.footerText().length() > 500) {
            throw new IllegalArgumentException("The footer must be 500 characters or fewer");
        }
    }

    private static void diff(List<AuditTrailChangeResponse> out, String field, String before, String after, boolean changed) {
        if (changed) out.add(new AuditTrailChangeResponse(field, before, after));
    }

    private static String nz(String value) {
        return value == null ? "" : value.strip();
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }
}
