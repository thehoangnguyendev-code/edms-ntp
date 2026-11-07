package com.eqms.service;

import com.eqms.dto.document.RevisionDetailResponse;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** A revision that is not effective yet has no Effective Date: the placeholder prints nothing, not a dash or a date. */
class PublishingEffectiveDatePlaceholderTest {

    private final PublishingTemplatePlaceholderMapperService mapper =
            new PublishingTemplatePlaceholderMapperService(mock(ParentDocumentResolver.class));

    @Test
    void effectiveDateIsEmptyUntilTheRevisionHasOne() {
        RevisionDetailResponse revision = mock(RevisionDetailResponse.class);
        when(revision.effectiveDate()).thenReturn(null);

        var mapping = mapper.mapPlaceholders(List.of("{{effectiveDate}}"), revision).get(0);

        assertEquals("", mapping.sampleValue());
    }

    @Test
    void effectiveDateIsPrintedOnceTheRevisionHasOne() {
        RevisionDetailResponse revision = mock(RevisionDetailResponse.class);
        when(revision.effectiveDate()).thenReturn("03/11/2026");

        var mapping = mapper.mapPlaceholders(List.of("{{effectiveDate}}"), revision).get(0);

        assertEquals("03/11/2026", mapping.sampleValue());
    }
}
