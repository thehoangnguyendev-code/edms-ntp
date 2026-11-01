package com.eqms.service;

import com.eqms.dto.publishing.PublishingPlaceholderGroupResponse;
import com.eqms.entity.ElectronicSignature;
import com.eqms.entity.ElectronicSignatureMeaning;
import com.eqms.repository.ElectronicSignatureMeaningRepository;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * A signed electronic signature is written in a document in one way only, the Standard frame. It has what 21 CFR 11.50 requires of a signed record; the catalog lists the placeholders
 * without a style; a name of an old template with a style ending is read as the same placeholder.
 */
class SignatureStandardFrameTest {

    private final ElectronicSignatureMeaningRepository meanings = mock(ElectronicSignatureMeaningRepository.class);
    private final ElectronicSignatureRendererService renderer = new ElectronicSignatureRendererService(meanings);

    private ElectronicSignature signed() {
        ElectronicSignatureMeaning meaning = new ElectronicSignatureMeaning();
        meaning.setDisplayName("Approved");
        when(meanings.findByCodeIgnoreCase(anyString())).thenReturn(Optional.of(meaning));
        ElectronicSignature s = new ElectronicSignature();
        s.setFullName("Nguyen Van A");
        s.setMeaning("APPROVED");
        s.setReason("Document Approval");
        s.setStatus("SIGNED");
        s.setSignedAt(Instant.parse("2026-10-26T16:16:29Z"));
        s.setTimezone("Asia/Ho_Chi_Minh");
        s.setSignatureId("SIG-2026-8F3A9B");
        return s;
    }

    @Test
    void aSignedSignatureIsTheStandardFrame() {
        assertThat(renderer.renderStandard(signed())).isEqualTo("Nguyen Van A\nElectronically approved\n26/10/2026 23:16 (UTC+07)");
    }

    @Test
    void theFrameHasTheNameTheMeaningAndTheDateAndTimeAndNothingOfTheRecordElse() {
        String text = renderer.renderStandard(signed());
        assertThat(text).contains("Nguyen Van A").containsIgnoringCase("approved").contains("26/10/2026 23:16").contains("(UTC+07)");
        // the reason and the signature ID stay on the record and in the Audit Trail
        assertThat(text).doesNotContain("Document Approval").doesNotContain("SIG-2026-8F3A9B");
    }

    @Test
    void aSignatureThatIsNotSignedOrLacksAMandatoryFieldIsWrittenInFullNeverShortened() {
        ElectronicSignature pending = signed();
        pending.setStatus("PENDING");
        assertThat(renderer.renderStandard(pending)).isEqualTo(renderer.renderTextBlock(pending, null));

        ElectronicSignature noTime = signed();
        noTime.setSignedAt(null);
        assertThat(renderer.renderStandard(noTime)).isEqualTo(renderer.renderTextBlock(noTime, null));

        ElectronicSignature noName = signed();
        noName.setFullName(" ");
        assertThat(renderer.renderStandard(noName)).isEqualTo(renderer.renderTextBlock(noName, null));
    }

    @Test
    void anAcronymOfTheMeaningKeepsItsCapitals() {
        assertThat(ElectronicSignatureRendererService.lowerCaseKeepingAcronyms("Attendance List Sent to QA")).isEqualTo("attendance list sent to QA");
        assertThat(ElectronicSignatureRendererService.lowerCaseKeepingAcronyms("Approved")).isEqualTo("approved");
        assertThat(ElectronicSignatureRendererService.lowerCaseKeepingAcronyms("DCO Submit for Review")).isEqualTo("DCO submit for review");
    }

    @Test
    void theSampleOfTheSettingsScreenIsTheSameFrame() {
        var preview = renderer.renderStylePreview();
        assertThat(preview.style()).isEqualTo("STANDARD");
        assertThat(preview.text()).contains("Electronically approved");
    }

    @Test
    void aNameOfAnOldTemplateWithAStyleEndingIsTheSamePlaceholder() {
        assertThat(SignaturePlaceholderName.baseName("approvedSignatureCompact")).isEqualTo("approvedSignature");
        assertThat(SignaturePlaceholderName.baseName("approved_signature_standard")).isEqualTo("approved_signature");
        assertThat(SignaturePlaceholderName.baseName("reviewerSignature2Detailed")).isEqualTo("reviewerSignature2");
        assertThat(SignaturePlaceholderName.baseName("approverSignaturesCompact")).isEqualTo("approverSignatures");
        assertThat(SignaturePlaceholderName.hasLegacyEnding("approvedSignatureCompact")).isTrue();
        assertThat(SignaturePlaceholderName.hasLegacyEnding("approvedSignature")).isFalse();
        // a name that is not a signature placeholder is never touched
        assertThat(SignaturePlaceholderName.baseName("documentTypeStandard")).isEqualTo("documentTypeStandard");
        assertThat(SignaturePlaceholderName.hasLegacyEnding("compact")).isFalse();
    }

    private List<PublishingPlaceholderGroupResponse> groups() {
        return new PublishingPlaceholderCatalogService().getAvailablePlaceholders(null).groups();
    }

    @Test
    void theCatalogListsTheSignaturePlaceholdersWithoutAStyle() {
        var signatureGroups = groups().stream().filter(g -> g.title().startsWith("Signature")).toList();
        assertThat(signatureGroups).extracting(PublishingPlaceholderGroupResponse::title).containsExactly("Signature", "Signature - Several Reviewers or Approvers");
        assertThat(signatureGroups.get(0).items()).extracting(i -> i.value())
                .containsExactly("{{PREPARED_SIGNATURE}}", "{{REVIEWED_SIGNATURE}}", "{{APPROVED_SIGNATURE}}", "{{PUBLISHED_SIGNATURE}}");
        assertThat(signatureGroups.get(1).items()).extracting(i -> i.value()).containsExactly("{{REVIEWER_SIGNATURES}}", "{{APPROVER_SIGNATURES}}");
        var all = groups().stream().flatMap(g -> g.items().stream()).map(i -> i.value().toUpperCase()).toList();
        assertThat(all).noneMatch(v -> v.contains("SIGNATURE") && (v.contains("COMPACT") || v.contains("DETAILED") || v.contains("STANDARD")));
    }

    @Test
    void theSearchOfTheCatalogFindsThem() {
        var found = new PublishingPlaceholderCatalogService().getAvailablePlaceholders("approved_signature");
        assertThat(found.groups()).hasSize(1);
        assertThat(found.groups().get(0).items()).extracting(i -> i.value()).containsExactly("{{APPROVED_SIGNATURE}}");
    }
}
