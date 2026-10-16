package com.eqms.service.report;

import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.service.AuditTrailService;
import com.eqms.service.EffectivePermissionService;
import com.eqms.service.SecurityChangeSignatureService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** REPORT-DEFINITION-SIGNATURE-2026-10-14: which changes need a signature, and refusal before anything is written. */
class ReportTemplateSignatureTest {

    private static final ReportTemplateService.FieldWrite NUMBER = new ReportTemplateService.FieldWrite("documentNumber", true, true, true);
    private static final ReportTemplateService.FieldWrite NAME = new ReportTemplateService.FieldWrite("documentName", true, true, true);

    @Test
    void aFieldTokenIsNormalisedTheSameWayItIsStored() {
        // The database stores default_selected as allowed && (defaultSelected || required); a request must compare the same way.
        var hidden = new ReportTemplateService.FieldWrite("status", false, true, false);
        var hiddenPlain = new ReportTemplateService.FieldWrite("status", false, false, false);
        assertThat(ReportTemplateService.fieldToken(hidden)).isEqualTo(ReportTemplateService.fieldToken(hiddenPlain));
    }

    @Test
    void theOrderOfFormatsAndFieldsDoesNotCountAsAChange() {
        String a = ReportTemplateService.form(true, List.of("PDF", "CSV"), List.of("x:true:true:false", "y:true:false:true"), List.of());
        String b = ReportTemplateService.form(true, List.of("CSV", "PDF"), List.of("y:true:false:true", "x:true:true:false"), List.of());
        assertThat(a).isEqualTo(b);
    }

    @Test
    void aChangeOfScopeOrFormatOrActivationIsAChange() {
        String base = ReportTemplateService.form(true, List.of("PDF"), List.of("x:true:true:false"), List.of("r:SYSTEM"));
        assertThat(ReportTemplateService.form(true, List.of("PDF"), List.of("x:true:true:false"), List.of("r:DEPARTMENT"))).isNotEqualTo(base);
        assertThat(ReportTemplateService.form(true, List.of("PDF", "XLSX"), List.of("x:true:true:false"), List.of("r:SYSTEM"))).isNotEqualTo(base);
        assertThat(ReportTemplateService.form(false, List.of("PDF"), List.of("x:true:true:false"), List.of("r:SYSTEM"))).isNotEqualTo(base);
    }

    private static UserAccount manager() {
        var actor = new UserAccount();
        actor.setId(UUID.randomUUID());
        actor.setStatus(UserStatus.Active);
        return actor;
    }

    private static ReportTemplateService.TemplateWrite newDefinition(String token) {
        return new ReportTemplateService.TemplateWrite(null, "DOCUMENT_STATUS", "New register", "A register of documents", true, List.of("PDF"),
                List.of(NUMBER, NAME), List.of(), "Create a register", null, token);
    }

    @Test
    void aNewDefinitionWithoutASignatureIsRefusedBeforeAnyWrite() {
        var signatures = mock(SecurityChangeSignatureService.class);
        var jdbc = mock(JdbcTemplate.class);
        var permissions = mock(EffectivePermissionService.class);
        when(permissions.getEffectivePermissionCodes(any(UserAccount.class))).thenReturn(Set.of("reports.definition.manage"));
        var service = new ReportTemplateService(jdbc, new ObjectMapper(), permissions, mock(AuditTrailService.class), List.of(new DocumentReportMetadataProvider()));
        service.configureSignatures(signatures);
        doThrow(new AccessDeniedException("Electronic signature is required")).when(signatures).requireValidToken(any(), any());

        assertThatThrownBy(() -> service.save(manager(), "NEW_REGISTER", newDefinition(null), true))
                .isInstanceOf(AccessDeniedException.class);
        assertThat(mockingNoWrites(jdbc)).isTrue();
    }

    @Test
    void withoutASignatureServiceASaveFailsClosed() {
        var jdbc = mock(JdbcTemplate.class);
        var permissions = mock(EffectivePermissionService.class);
        when(permissions.getEffectivePermissionCodes(any(UserAccount.class))).thenReturn(Set.of("reports.definition.manage"));
        var service = new ReportTemplateService(jdbc, new ObjectMapper(), permissions, mock(AuditTrailService.class), List.of(new DocumentReportMetadataProvider()));

        assertThatThrownBy(() -> service.save(manager(), "NEW_REGISTER", newDefinition("tok"), true))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("REPORT_SIGNATURE_UNAVAILABLE");
        assertThat(mockingNoWrites(jdbc)).isTrue();
    }

    @Test
    void aTemplateWithoutADescriptionIsRefusedAndTheDescriptionBecomesTheReason() {
        var jdbc = mock(JdbcTemplate.class);
        var permissions = mock(EffectivePermissionService.class);
        when(permissions.getEffectivePermissionCodes(any(UserAccount.class))).thenReturn(Set.of("reports.definition.manage"));
        var service = new ReportTemplateService(jdbc, new ObjectMapper(), permissions, mock(AuditTrailService.class), List.of(new DocumentReportMetadataProvider()));
        var blank = new ReportTemplateService.TemplateWrite(null, "DOCUMENT_STATUS", "New register", "  ", true, List.of("PDF"), List.of(NUMBER, NAME), List.of(), "", null, "tok");
        assertThatThrownBy(() -> service.save(manager(), "NEW_REGISTER", blank, true)).isInstanceOf(IllegalArgumentException.class).hasMessage("REPORT_DESCRIPTION_REQUIRED");
        var noReason = new ReportTemplateService.TemplateWrite(null, "DOCUMENT_STATUS", "New register", " Quarterly register ", true, List.of("PDF"), List.of(NUMBER, NAME), List.of(), "", null, "tok");
        assertThat(ReportTemplateService.withDescriptionAsReason(noReason).reason()).isEqualTo("Quarterly register");
        var withReason = new ReportTemplateService.TemplateWrite(null, "DOCUMENT_STATUS", "New register", "Quarterly register", true, List.of("PDF"), List.of(NUMBER, NAME), List.of(), "Own reason", null, "tok");
        assertThat(ReportTemplateService.withDescriptionAsReason(withReason).reason()).isEqualTo("Own reason");
        assertThat(mockingNoWrites(jdbc)).isTrue();
    }

    /** True when the template service has not issued a single update or insert against the database. */
    private static boolean mockingNoWrites(JdbcTemplate jdbc) {
        return org.mockito.Mockito.mockingDetails(jdbc).getInvocations().stream().noneMatch(i -> i.getMethod().getName().equals("update"));
    }
}
