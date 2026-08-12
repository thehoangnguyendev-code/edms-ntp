package com.eqms;

import com.eqms.entity.ElectronicSignature;
import com.eqms.entity.ElectronicSignatureSetting;
import com.eqms.repository.ElectronicSignatureMeaningRepository;
import com.eqms.service.ElectronicSignatureRendererService;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ElectronicSignatureRendererServiceTest {

    private final ElectronicSignatureMeaningRepository meaningRepository = mock(ElectronicSignatureMeaningRepository.class);
    private final ElectronicSignatureRendererService renderer = new ElectronicSignatureRendererService(meaningRepository);

    @Test
    void formatsNewSignatureTimestampWithTheActiveConfiguration() {
        ElectronicSignatureSetting setting = setting("dd/MM/uuuu HH:mm:ss", "Asia/Ho_Chi_Minh");

        assertEquals(
                "17/07/2026 15:30:00 (UTC+7)",
                renderer.formatTimestampSnapshot(Instant.parse("2026-07-17T08:30:00Z"), setting)
        );
    }

    @Test
    void preservesLegacySignatureDisplayWhenTheActiveConfigurationChanges() {
        when(meaningRepository.findByCodeIgnoreCase("APPROVED")).thenReturn(Optional.empty());
        ElectronicSignature legacy = new ElectronicSignature();
        legacy.setId(UUID.randomUUID());
        legacy.setFullName("Nguyen Van A");
        legacy.setMeaning("APPROVED");
        legacy.setStatus("SIGNED");
        legacy.setSignedAt(Instant.parse("2026-07-17T08:30:00Z"));
        legacy.setTimezone("UTC+7");

        String block = renderer.renderTextBlock(legacy, setting("uuuu-MM-dd HH:mm", "UTC"));

        assertTrue(block.contains("17-Jul-2026 15:30 (UTC+7)"));
    }

    @Test
    void rejectsTimestampPatternsOutsideTheControlledCatalog() {
        assertThrows(IllegalArgumentException.class, () -> renderer.normalizeTimestampFormat("dd.MM.yyyy HH:mm"));
    }

    private ElectronicSignatureSetting setting(String format, String timezone) {
        ElectronicSignatureSetting setting = new ElectronicSignatureSetting();
        setting.setSignatureTimestampFormat(format);
        setting.setSignatureTimezone(timezone);
        return setting;
    }
}
