package com.eqms.service;

import com.eqms.entity.ElectronicSignature;
import com.eqms.entity.ElectronicSignatureMeaning;
import com.eqms.repository.ElectronicSignatureMeaningRepository;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** The three display styles of a signed electronic signature: placeholders choose them by name, and none drops what 21 CFR 11.50 requires of a signed record. */
class SignatureDisplayStyleTest {

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
    void thePlaceholderNameChoosesTheStyleAndTheRestIsTheSameSignaturePlaceholder() {
        assertThat(SignatureDisplayStyle.ofName("approvedSignatureCompact")).isEqualTo(SignatureDisplayStyle.COMPACT);
        assertThat(SignatureDisplayStyle.ofName("approved_signature_standard")).isEqualTo(SignatureDisplayStyle.STANDARD);
        assertThat(SignatureDisplayStyle.ofName("reviewerSignature2Detailed")).isEqualTo(SignatureDisplayStyle.DETAILED);
        assertThat(SignatureDisplayStyle.ofName("approverSignaturesCompact")).isEqualTo(SignatureDisplayStyle.COMPACT);
        assertThat(SignatureDisplayStyle.baseName("approvedSignatureCompact")).isEqualTo("approvedSignature");
        assertThat(SignatureDisplayStyle.baseName("approved_signature_standard")).isEqualTo("approved_signature");
        assertThat(SignatureDisplayStyle.baseName("reviewerSignature2Detailed")).isEqualTo("reviewerSignature2");
    }

    @Test
    void aNameThatIsNotASignaturePlaceholderIsNeverReadAsAStyle() {
        assertThat(SignatureDisplayStyle.ofName("approvedSignature")).isNull();
        assertThat(SignatureDisplayStyle.ofName("documentTypeStandard")).isNull();
        assertThat(SignatureDisplayStyle.ofName("compact")).isNull();
        assertThat(SignatureDisplayStyle.baseName("documentTypeStandard")).isEqualTo("documentTypeStandard");
    }

    @Test
    void everyStyleHasTheNameTheMeaningAndTheDateAndTimeOfTheSameRecord() {
        ElectronicSignature s = signed();
        for (SignatureDisplayStyle style : SignatureDisplayStyle.values()) {
            String text = renderer.renderStyled(s, style);
            assertThat(text).as(style + " has the printed name").contains("Nguyen Van A");
            assertThat(text.toLowerCase()).as(style + " has the meaning").contains("approved");
            assertThat(text).as(style + " has the date and time").contains("26/10/2026 23:16").contains("(UTC+07)");
        }
    }

    @Test
    void theStylesAreTheShapesOfTheDesign() {
        ElectronicSignature s = signed();
        assertThat(renderer.renderStyled(s, SignatureDisplayStyle.COMPACT)).isEqualTo("Nguyen Van A\nApproved · 26/10/2026 23:16 (UTC+07)");
        assertThat(renderer.renderStyled(s, SignatureDisplayStyle.STANDARD)).isEqualTo("Nguyen Van A\nElectronically approved\n26/10/2026 23:16 (UTC+07)");
        assertThat(renderer.renderStyled(s, SignatureDisplayStyle.DETAILED)).isEqualTo("Nguyen Van A\nApproved · 26/10/2026 23:16 (UTC+07)\nSIG-2026-8F3A9B");
    }

    @Test
    void aSignatureThatIsNotSignedOrLacksAMandatoryFieldIsWrittenInFullNeverShortened() {
        ElectronicSignature pending = signed();
        pending.setStatus("PENDING");
        assertThat(renderer.renderStyled(pending, SignatureDisplayStyle.COMPACT)).isEqualTo(renderer.renderTextBlock(pending, null));

        ElectronicSignature noTime = signed();
        noTime.setSignedAt(null);
        assertThat(renderer.renderStyled(noTime, SignatureDisplayStyle.STANDARD)).isEqualTo(renderer.renderTextBlock(noTime, null));

        ElectronicSignature noName = signed();
        noName.setFullName(" ");
        assertThat(renderer.renderStyled(noName, SignatureDisplayStyle.DETAILED)).isEqualTo(renderer.renderTextBlock(noName, null));
    }
}
