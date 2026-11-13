package com.eqms.service;

import com.eqms.entity.EmailDesign;
import com.eqms.util.EmailFrameRenderer;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** NOTIFICATION-ADMIN-2026-11-12 (D2): one frame for every email, and the rules the shared design must obey. */
class EmailFrameAndDesignTest {

    private static EmailDesign design() {
        EmailDesign d = new EmailDesign();
        d.setBrandColor("#0B5FFF");
        d.setFontFamily("Verdana");
        d.setLogoUrl("https://cdn.example/logo.png");
        d.setFooterText("(c) {year} Ngoc Thien Pharma. Automatic message.");
        d.setSupportEmail("qa@ngocthien.example");
        return d;
    }

    @Test
    void theFrameCarriesTheSharedDesignAroundTheContent() {
        String html = EmailFrameRenderer.render(design(), "<p>Hello</p>");
        assertThat(html).startsWith("<!DOCTYPE html>").contains("<p>Hello</p>").contains("#0B5FFF").contains("'Verdana'")
                .contains("https://cdn.example/logo.png").contains("qa@ngocthien.example").contains(String.valueOf(java.time.Year.now().getValue()))
                .doesNotContain("{year}");
        assertThat(html).as("a narrow screen is handled and no automatic dark scheme changes the colours").contains("max-width:620px").doesNotContain("prefers-color-scheme:dark");
    }

    @Test
    void withNoDesignTheFrameStillWorksAndSaysEqms() {
        String html = EmailFrameRenderer.render(null, "<p>Hi</p>");
        assertThat(html).contains("EQMS").contains("#059669").contains("<p>Hi</p>");
    }

    @Test
    void aColourOrFontThatIsNotSafeFallsBackInsteadOfBreakingTheMail() {
        EmailDesign d = design();
        d.setBrandColor("red;} body{display:none");
        d.setFontFamily("Comic Sans'; background:url(x)");
        String html = EmailFrameRenderer.render(d, "x");
        assertThat(html).contains("#059669").contains("'Arial'").doesNotContain("display:none").doesNotContain("url(x)");
    }

    @Test
    void theFooterAndTheLogoAddressAreEscaped() {
        EmailDesign d = design();
        d.setFooterText("<script>alert(1)</script>");
        d.setLogoUrl("https://x.example/a.png\" onerror=\"alert(1)");
        String html = EmailFrameRenderer.render(d, "x");
        assertThat(html).doesNotContain("<script>").contains("&lt;script&gt;").doesNotContain("\" onerror=\"alert");
    }

    @Test
    void plainTextBecomesParagraphsAndMarkupIsKept() {
        assertThat(EmailFrameRenderer.paragraphs("One\ntwo\n\nThree & four")).isEqualTo(
                "<p style=\"margin:0 0 14px;\">One<br>two</p><p style=\"margin:0 0 14px;\">Three &amp; four</p>");
        assertThat(EmailFrameRenderer.paragraphs("<p>Already html</p>")).isEqualTo("<p>Already html</p>");
        assertThat(EmailFrameRenderer.paragraphs(" ")).isEmpty();
    }

    @Test
    void theButtonNeedsAWebAddressAndEscapesItsWords() {
        assertThat(EmailFrameRenderer.button("Open", "javascript:alert(1)", "#059669")).isEmpty();
        assertThat(EmailFrameRenderer.button("Open", "/relative", "#059669")).isEmpty();
        assertThat(EmailFrameRenderer.button("Open", null, "#059669")).isEmpty();
        String button = EmailFrameRenderer.button("<b>Go</b>", "https://eqms.example/x?a=1&b=2", "#059669");
        assertThat(button).contains("&lt;b&gt;Go&lt;/b&gt;").contains("https://eqms.example/x?a=1&amp;b=2");
        assertThat(EmailFrameRenderer.button(null, "https://eqms.example/x", "#059669")).contains("Open in EQMS");
    }

    @Test
    void aWholePageIsNotFramedTwice() {
        assertThat(EmailFrameRenderer.isFullDocument("  <!DOCTYPE html><html></html>")).isTrue();
        assertThat(EmailFrameRenderer.isFullDocument("<HTML><body>")).isTrue();
        assertThat(EmailFrameRenderer.isFullDocument("<p>text</p>")).isFalse();
        assertThat(EmailFrameRenderer.isFullDocument(null)).isFalse();
    }

    private static EmailDesignService.Change change(String logo, String color, String font, String footer, String support) {
        return new EmailDesignService.Change(logo, color, font, footer, support);
    }

    @Test
    void theDesignMustBeSafeToStoreAndToPutInAMail() {
        assertThatCode(() -> EmailDesignService.validate(change(null, "#059669", "Arial", null, null))).doesNotThrowAnyException();
        assertThatCode(() -> EmailDesignService.validate(change("data:image/png;base64,iVBORw0KGgo=", "#059669", "Tahoma", "x", "qa@x.example"))).doesNotThrowAnyException();
        assertThatThrownBy(() -> EmailDesignService.validate(change(null, "green", "Arial", null, null))).hasMessageContaining("#RRGGBB");
        assertThatThrownBy(() -> EmailDesignService.validate(change(null, "#059669", "Comic Sans", null, null))).hasMessageContaining("font");
        assertThatThrownBy(() -> EmailDesignService.validate(change("javascript:alert(1)", "#059669", "Arial", null, null))).hasMessageContaining("logo");
        assertThatThrownBy(() -> EmailDesignService.validate(change("data:text/html;base64,AAAA", "#059669", "Arial", null, null))).hasMessageContaining("logo");
        assertThatThrownBy(() -> EmailDesignService.validate(change("data:image/png;base64," + "A".repeat(EmailDesignService.MAX_LOGO_LENGTH), "#059669", "Arial", null, null))).hasMessageContaining("too large");
        assertThatThrownBy(() -> EmailDesignService.validate(change(null, "#059669", "Arial", null, "not-an-address"))).hasMessageContaining("support");
        assertThatThrownBy(() -> EmailDesignService.validate(change(null, "#059669", "Arial", "x".repeat(501), null))).hasMessageContaining("500");
        assertThatThrownBy(() -> EmailDesignService.validate(null)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void theBodyAndFooterColoursAndTheAlignmentsAreInTheMail() {
        EmailDesign d = design();
        d.setBodyColor("#FEF3C7");
        d.setFooterColor("#1E293B");
        d.setLogoAlign("CENTER");
        d.setFooterAlign("RIGHT");
        String html = EmailFrameRenderer.render(d, "<p>Hi</p>");
        assertThat(html).contains("background:#FEF3C7").contains("background:#1E293B")
                .contains("padding:26px 40px;text-align:center;").contains("text-align:right;");
        assertThat(html).doesNotContain("prefers-color-scheme:dark");
    }

    @Test
    void anUnsafeColourOrAlignmentFallsBackToTheDefault() {
        EmailDesign d = design();
        d.setBodyColor("red;} x{y");
        d.setFooterColor("nope");
        d.setLogoAlign("justify");
        d.setFooterAlign(null);
        String html = EmailFrameRenderer.render(d, "x");
        assertThat(html).contains("background:#FFFFFF").contains("background:#F8FAFC").contains("text-align:left;").doesNotContain("x{y");
    }

    @Test
    void withNoLogoTheHeaderSaysTheHeaderTitleOfTheConfiguration() {
        EmailDesign d = design();
        d.setLogoUrl(null);
        assertThat(EmailFrameRenderer.render(d, "x", "Ngoc Thien <QMS>")).contains("Ngoc Thien &lt;QMS&gt;").doesNotContain("https://cdn.example/logo.png");
        assertThat(EmailFrameRenderer.render(d, "x", " ")).contains(">EQMS</span>");
        d.setLogoUrl("https://cdn.example/logo.png");
        assertThat(EmailFrameRenderer.render(d, "x", "Ngoc Thien QMS")).contains("https://cdn.example/logo.png").doesNotContain("Ngoc Thien QMS");
    }

    @Test
    void theTextColoursOfTheHeaderTheBodyAndTheFooterAreTheOnesTheDesignSets() {
        EmailDesign d = design();
        d.setLogoUrl(null);
        d.setHeaderTextColor("#FDE68A");
        d.setBodyTextColor("#111827");
        d.setFooterTextColor("#A7F3D0");
        String html = EmailFrameRenderer.render(d, "<h2>Title</h2><p>Hi</p>", "Ngoc Thien");
        assertThat(html).contains("color:#FDE68A;font-size:20px").contains("color:#111827;\">").contains("h1,h2,h3{color:#111827;").contains("color:#A7F3D0;");
        d.setBodyTextColor("javascript:x");
        assertThat(EmailFrameRenderer.render(d, "x")).contains("color:#334155;").doesNotContain("javascript");
    }

    @Test
    void theHeaderColourIsOnlyTheHeaderAndTheButtonAndLinksHaveTheirOwn() {
        EmailDesign d = design();
        d.setBrandColor("#0B5FFF");
        d.setButtonColor("#E11D48");
        String html = EmailFrameRenderer.render(d, "<p>x</p>" + EmailFrameRenderer.button("Go", "https://eqms.example/x", d.getButtonColor()), "T");
        assertThat(html).contains("class=\"eq-head\" style=\"background:#0B5FFF;").contains("a{color:#E11D48;}").contains("background:#E11D48;\"><a href");
        assertThat(html).doesNotContain("a{color:#0B5FFF;}").doesNotContain("color:#0B5FFF;text-decoration:none");
        assertThatThrownBy(() -> EmailDesignService.validate(new EmailDesignService.Change("x.png", null, "#0B5FFF", "nope", "#FFFFFF", "#F8FAFC", "LEFT", "LEFT", "#FFFFFF", null, "#334155", "#6B7280", "Arial", null, null))).hasMessageContaining("button colour");
    }

    @Test
    void theHeaderSaysTheTextOfTheDesignAndALogoPictureTakesItsPlace() {
        EmailDesign d = design();
        d.setLogoUrl(null);
        d.setLogoText("Ngoc <Thien> Pharma");
        assertThat(EmailFrameRenderer.render(d, "x", "Title of the configuration")).contains("Ngoc &lt;Thien&gt; Pharma").doesNotContain("Title of the configuration");
        d.setLogoUrl("https://cdn.example/logo.png");
        assertThat(EmailFrameRenderer.render(d, "x", "T")).contains("https://cdn.example/logo.png").doesNotContain("Ngoc &lt;Thien&gt; Pharma");
    }

    @Test
    void theHeaderHasItsOwnFontOrUsesTheFontOfTheBody() {
        EmailDesign d = design();
        d.setLogoUrl(null);
        assertThat(EmailFrameRenderer.render(d, "x", "Ngoc Thien")).doesNotContain("font-family:'Georgia'");
        d.setHeaderFontFamily("Georgia");
        assertThat(EmailFrameRenderer.render(d, "x", "Ngoc Thien")).contains("<span style=\"font-family:'Georgia',Arial,Helvetica,sans-serif;color:");
        d.setHeaderFontFamily("Comic Sans'; x:y");
        assertThat(EmailFrameRenderer.render(d, "x", "Ngoc Thien")).contains("<span style=\"font-family:'Arial'").doesNotContain("x:y");
        assertThatThrownBy(() -> EmailDesignService.validate(new EmailDesignService.Change(null, "#059669", "#FFFFFF", "#F8FAFC", "LEFT", "LEFT", "#FFFFFF", "Comic Sans", "#334155", "#6B7280", "Arial", null, null))).hasMessageContaining("header font");
        assertThatCode(() -> EmailDesignService.validate(new EmailDesignService.Change(null, "#059669", "#FFFFFF", "#F8FAFC", "LEFT", "LEFT", "#FFFFFF", "Georgia", "#334155", "#6B7280", "Arial", null, null))).doesNotThrowAnyException();
    }

    @Test
    @SuppressWarnings("unchecked")
    void aDesignIsNotSavedWithoutALogoButItsPreviewMayBeMadeWithoutOne() {
        var repository = org.mockito.Mockito.mock(com.eqms.repository.EmailDesignRepository.class);
        var users = org.mockito.Mockito.mock(com.eqms.auth.CurrentUserService.class);
        org.mockito.Mockito.when(users.requireCurrentUser()).thenReturn(new com.eqms.entity.UserAccount());
        var service = new EmailDesignService(repository, org.mockito.Mockito.mock(AuditTrailService.class), users,
                (org.springframework.beans.factory.ObjectProvider<SystemConfigurationService>) org.mockito.Mockito.mock(org.springframework.beans.factory.ObjectProvider.class));
        for (String none : new String[] {null, "", "  "}) {
            assertThatThrownBy(() -> service.update(new EmailDesignService.Change(none, "#059669", "Arial", null, null))).hasMessageContaining("needs a text or a logo");
        }
        org.mockito.Mockito.verify(repository, org.mockito.Mockito.never()).save(org.mockito.ArgumentMatchers.any());
        // a text alone is enough: the header says it
        org.mockito.Mockito.when(repository.save(org.mockito.ArgumentMatchers.any())).thenAnswer(call -> call.getArgument(0));
        var saved = service.update(new EmailDesignService.Change(null, "Ngoc Thien Pharma", "#059669", "#FFFFFF", "#F8FAFC", "LEFT", "LEFT", "#FFFFFF", null, "#334155", "#6B7280", "Arial", null, null));
        assertThat(saved.getLogoText()).isEqualTo("Ngoc Thien Pharma");
        assertThat(saved.getLogoUrl()).isNull();
        assertThatThrownBy(() -> service.update(new EmailDesignService.Change(null, "two\nlines", "#059669", "#FFFFFF", "#F8FAFC", "LEFT", "LEFT", "#FFFFFF", null, "#334155", "#6B7280", "Arial", null, null))).hasMessageContaining("one line");
        assertThatCode(() -> EmailDesignService.validate(new EmailDesignService.Change(null, "#059669", "Arial", null, null))).doesNotThrowAnyException();
    }

    @Test
    void aPreviewFillsItsColumnAndIsSquare() {
        assertThat(EmailFrameRenderer.render(design(), "x", "T", true)).contains("max-width:100%").contains("border-radius:0");
        assertThat(EmailFrameRenderer.render(design(), "x", "T", false)).contains("max-width:600px").contains("border-radius:16px");
    }

    @Test
    void aPreviewIsTheCardAloneWithoutTheGreyPage() {
        String sent = EmailFrameRenderer.render(design(), "x", "T", false);
        String preview = EmailFrameRenderer.render(design(), "x", "T", true);
        assertThat(sent).contains("background:#f1f5f9").contains("padding:32px 16px");
        assertThat(preview).doesNotContain("#f1f5f9").contains("background:transparent").contains("padding:0;");
    }

    @Test
    void theTextColoursMustBeValidToBeStored() {
        assertThatThrownBy(() -> EmailDesignService.validate(new EmailDesignService.Change(null, "#059669", "#FFFFFF", "#F8FAFC", "LEFT", "LEFT", "white", "#334155", "#6B7280", "Arial", null, null))).hasMessageContaining("header text colour");
        assertThatThrownBy(() -> EmailDesignService.validate(new EmailDesignService.Change(null, "#059669", "#FFFFFF", "#F8FAFC", "LEFT", "LEFT", "#FFFFFF", "", "#6B7280", "Arial", null, null))).hasMessageContaining("body text colour");
        assertThatThrownBy(() -> EmailDesignService.validate(new EmailDesignService.Change(null, "#059669", "#FFFFFF", "#F8FAFC", "LEFT", "LEFT", "#FFFFFF", "#334155", null, "Arial", null, null))).hasMessageContaining("footer text colour");
    }

    @Test
    void theColoursAndAlignmentsMustBeValidToBeStored() {
        assertThatCode(() -> EmailDesignService.validate(new EmailDesignService.Change(null, "#059669", "#FFFFFF", "#F8FAFC", "RIGHT", "CENTER", "Arial", null, null))).doesNotThrowAnyException();
        assertThatThrownBy(() -> EmailDesignService.validate(new EmailDesignService.Change(null, "#059669", "white", "#F8FAFC", "LEFT", "LEFT", "Arial", null, null))).hasMessageContaining("body colour");
        assertThatThrownBy(() -> EmailDesignService.validate(new EmailDesignService.Change(null, "#059669", "#FFFFFF", "", "LEFT", "LEFT", "Arial", null, null))).hasMessageContaining("footer colour");
        assertThatThrownBy(() -> EmailDesignService.validate(new EmailDesignService.Change(null, "#059669", "#FFFFFF", "#F8FAFC", "MIDDLE", "LEFT", "Arial", null, null))).hasMessageContaining("logo alignment");
        assertThatThrownBy(() -> EmailDesignService.validate(new EmailDesignService.Change(null, "#059669", "#FFFFFF", "#F8FAFC", "LEFT", null, "Arial", null, null))).hasMessageContaining("footer alignment");
    }

    @Test
    @SuppressWarnings("unchecked")
    void aDesignThatSomeoneElseSavedAfterItWasOpenedIsNotOverwritten() {
        var repository = org.mockito.Mockito.mock(com.eqms.repository.EmailDesignRepository.class);
        var users = org.mockito.Mockito.mock(com.eqms.auth.CurrentUserService.class);
        org.mockito.Mockito.when(users.requireCurrentUser()).thenReturn(new com.eqms.entity.UserAccount());
        var stored = design();
        stored.setVersion(8);
        org.mockito.Mockito.when(repository.findAll()).thenReturn(java.util.List.of(stored));
        org.mockito.Mockito.when(repository.save(org.mockito.ArgumentMatchers.any())).thenAnswer(call -> call.getArgument(0));
        var service = new EmailDesignService(repository, org.mockito.Mockito.mock(AuditTrailService.class), users,
                (org.springframework.beans.factory.ObjectProvider<SystemConfigurationService>) org.mockito.Mockito.mock(org.springframework.beans.factory.ObjectProvider.class));
        var change = new EmailDesignService.Change(null, "Changed text", "#059669", "#FFFFFF", "#F8FAFC", "LEFT", "LEFT", "#FFFFFF", null, "#334155", "#6B7280", "Arial", null, null);
        // the person saw version 7; version 8 was saved meanwhile
        assertThatThrownBy(() -> service.update(change, 7)).isInstanceOf(IllegalStateException.class).hasMessageContaining("changed by someone else");
        org.mockito.Mockito.verify(repository, org.mockito.Mockito.never()).save(org.mockito.ArgumentMatchers.any());
        // the version they saw is the current one, or no version is given: saved, and the version moves on
        assertThat(service.update(change, 8).getVersion()).isEqualTo(9);
        assertThat(service.update(change, null)).isNotNull();
    }
}
