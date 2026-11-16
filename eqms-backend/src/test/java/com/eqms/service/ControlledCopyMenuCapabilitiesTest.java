package com.eqms.service;

import com.eqms.dto.document.*;
import com.eqms.dto.security.ControlledCopyActionCapabilitiesResponse;
import com.eqms.dto.user.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class ControlledCopyMenuCapabilitiesTest {
    private final ObjectMapper mapper=new ObjectMapper();
    @Test void singletonUsesChildDecisionAndMultiCopyUsesBatchDecision() {
        var authorization=mock(ControlledCopyAuthorizationService.class);
        UUID batch=UUID.randomUUID(), child=UUID.randomUUID(), multi=UUID.randomUUID();
        var single=mapper.convertValue(Map.of("id",batch.toString(),"quantity",1,"primaryControlledCopyId",child.toString()),ControlledCopyDistributionBatchSummaryResponse.class);
        var group=mapper.convertValue(Map.of("id",multi.toString(),"quantity",12),ControlledCopyDistributionBatchSummaryResponse.class);
        var copyDecision=mock(ControlledCopyActionCapabilitiesResponse.class);
        var batchDecision=mock(ControlledCopyActionCapabilitiesResponse.class);
        when(authorization.getCopyCapabilities(child)).thenReturn(copyDecision);
        when(authorization.getBatchCapabilities(multi)).thenReturn(batchDecision);
        var pagination=new PaginationResponse(2,10,22,3);
        var page=ControlledCopyMenuCapabilities.batches(new PageResponse<>(List.of(single,group),pagination),authorization);
        assertThat(page.data().get(0).capabilities()).isSameAs(copyDecision);
        assertThat(page.data().get(1).capabilities()).isSameAs(batchDecision);
        assertThat(page.pagination()).isSameAs(pagination);
        verify(authorization,never()).getBatchCapabilities(batch);
        verify(authorization).getCopyCapabilities(child);
        verify(authorization).getBatchCapabilities(multi);
        verifyNoMoreInteractions(authorization);
    }
    @Test void unavailableCapabilityKeepsVisibleMetadataButNeverGrantsAnAction() {
        var authorization=mock(ControlledCopyAuthorizationService.class);
        UUID id=UUID.randomUUID();
        var row=mapper.convertValue(Map.of("id",id.toString(),"name","Visible metadata"),ControlledCopyListItemResponse.class);
        when(authorization.getCopyCapabilities(id)).thenThrow(new AccessDeniedException("scope changed"));
        var result=ControlledCopyMenuCapabilities.copies(new PageResponse<>(List.of(row),new PaginationResponse(1,10,1,1)),authorization);
        assertThat(result.data().getFirst().name()).isEqualTo("Visible metadata");
        assertThat(result.data().getFirst().capabilities()).isNull();
    }
    @Test void emptyPageNeverQueriesAnyOtherObject() {
        var authorization=mock(ControlledCopyAuthorizationService.class);
        var result=ControlledCopyMenuCapabilities.copies(new PageResponse<>(List.of(),new PaginationResponse(1,10,0,0)),authorization);
        assertThat(result.data()).isEmpty();
        verifyNoInteractions(authorization);
    }
}
