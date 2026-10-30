package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.entity.*;
import com.eqms.service.DocumentService.KnowledgeEntry;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class KnowledgeQueryTest {
    @Test void onlyTheAuthorizedEntriesAreSearchedSortedAndCountedBeforePaging() {
        var documents = mock(DocumentService.class); var current = mock(CurrentUserService.class);
        var configuration = mock(SystemConfigurationService.class);
        when(current.requireCurrentUser()).thenReturn(new UserAccount());
        when(configuration.getKnowledgePortalViewsWindowDays()).thenReturn(30);
        var service = new KnowledgePortalService(documents, null, current, null, null, mock(JdbcTemplate.class), configuration, null);
        var a = entry("A matched"); var b = entry("B matched"); var noMatch = entry("Other");
        when(documents.visibleKnowledgeEntries()).thenReturn(List.of(b, noMatch, a));
        var page = service.queryDocuments("matched", "search", 2, 1, "name", "asc");
        assertThat(page.totalDocuments()).isEqualTo(2);
        assertThat(page.documents()).extracting(p -> p.document().id()).containsExactly(b.document().getId().toString());
        assertThat(service.queryDocuments("matched", "featured", 1, 10, "name", "asc").documents()).isEmpty();
        when(documents.visibleKnowledgeEntries()).thenThrow(new org.springframework.security.access.AccessDeniedException("DENIED"));
        assertThatThrownBy(() -> service.queryDocuments("matched", "search", 1, 10, "name", "asc")).isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        assertThatThrownBy(() -> service.queryDocuments("ab", "search", 1, 10, "name", "asc")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.queryDocuments("matched", "private", 1, 10, "name", "asc")).isInstanceOf(IllegalArgumentException.class);
    }
    private KnowledgeEntry entry(String name) {
        var d = new DocumentRecord(); d.setId(UUID.randomUUID()); d.setDocumentName(name); d.setDocumentNumber(name);
        var r = new DocumentRevisionRecord(); r.setId(UUID.randomUUID());
        return new KnowledgeEntry(d, r);
    }
}
