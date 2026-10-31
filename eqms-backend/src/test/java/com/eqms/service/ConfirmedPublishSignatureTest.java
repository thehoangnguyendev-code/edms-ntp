package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.auth.TokenService;
import com.eqms.entity.*;
import com.eqms.repository.*;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ConfirmedPublishSignatureTest {
    @Test void persistedConfirmationHasExactActorScopeAndOriginalTimestampWithoutReplayingJwt() {
        var records=mock(ElectronicSignatureRepository.class);
        var settings=mock(ElectronicSignatureSettingRepository.class);
        var tokens=mock(SignatureTokenConsumptionService.class);
        when(settings.findById(ElectronicSignatureSetting.DEFAULT_ID)).thenReturn(Optional.of(new ElectronicSignatureSetting()));
        when(records.nextSignatureSequence()).thenReturn(1L);
        when(records.save(any())).thenAnswer(call->call.getArgument(0));
        var service=new ElectronicSignatureService(records,settings,mock(ElectronicSignatureMeaningRepository.class),
                mock(RevisionWorkflowParticipantRepository.class),mock(CurrentUserService.class),mock(TokenService.class),
                mock(AuditTrailService.class),mock(ElectronicSignatureRendererService.class),tokens);
        var user=new UserAccount(); user.setId(UUID.randomUUID());
        var revision=new DocumentRevisionRecord(); revision.setId(UUID.randomUUID());
        Instant confirmedAt=Instant.parse("2026-10-31T00:00:00Z");
        var authorization=new ConfirmedPublishAuthorization(UUID.randomUUID(),user.getId(),confirmedAt,Set.of(revision.getId()),
                Map.of("fullName","Signer at confirmation","ipAddress","127.0.0.1"));
        var signature=service.createConfirmedPublishSignature(revision,user,"Publish confirmed content","READY_FOR_PUBLISHING","sha",authorization);
        assertEquals("PUBLISHED",signature.getMeaning());
        assertEquals(confirmedAt,signature.getSignedAt());
        assertEquals("Signer at confirmation",signature.getFullName());
        assertEquals("127.0.0.1",signature.getIpAddress());
        verifyNoInteractions(tokens);
        var other=new DocumentRevisionRecord(); other.setId(UUID.randomUUID());
        assertThrows(org.springframework.security.access.AccessDeniedException.class,()->service.createConfirmedPublishSignature(other,user,"reason","READY_FOR_PUBLISHING","sha",authorization));
        var otherUser=new UserAccount(); otherUser.setId(UUID.randomUUID());
        assertThrows(org.springframework.security.access.AccessDeniedException.class,()->service.createConfirmedPublishSignature(revision,otherUser,"reason","READY_FOR_PUBLISHING","sha",authorization));
    }
}
