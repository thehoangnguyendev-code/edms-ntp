package com.eqms;

import com.eqms.dto.navigation.NavigationItemResponse;
import com.eqms.service.NavigationService;
import com.eqms.service.SystemConfigurationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * The sidebar takes its visibility decisions from the server, so the Document Control "Records" menu (the scan of every
 * returned paper copy) must be offered here: the front end alone cannot show a menu the server does not list.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class RecordsNavigationTest {

    @Mock private SystemConfigurationService systemConfigurationService;

    private NavigationService navigation;

    @BeforeEach
    void setUp() {
        when(systemConfigurationService.isFeatureEnabled(any())).thenReturn(true);
        navigation = new NavigationService(systemConfigurationService);
    }

    private Optional<NavigationItemResponse> docControl(Set<String> permissions) {
        return navigation.getNavigation(permissions).stream().filter(item -> "doc-control".equals(item.id())).findFirst();
    }

    private static List<String> childIds(NavigationItemResponse item) {
        return item.children() == null ? List.of() : item.children().stream().map(NavigationItemResponse::id).toList();
    }

    @Test
    void records_is_listed_under_document_control_for_a_user_who_may_view_records() {
        NavigationItemResponse docControl = docControl(Set.of("documents.module.view", "documents.form.view_executed_records")).orElseThrow();

        assertThat(childIds(docControl)).contains("records");
        NavigationItemResponse records = docControl.children().stream().filter(item -> "records".equals(item.id())).findFirst().orElseThrow();
        assertThat(records.label()).isEqualTo("Records");
        assertThat(records.path()).isEqualTo("/documents/records");
    }

    @Test
    void records_is_not_listed_without_the_view_records_permission() {
        NavigationItemResponse docControl = docControl(Set.of("documents.module.view", "documents.document.view")).orElseThrow();

        assertThat(childIds(docControl)).doesNotContain("records");
    }

    @Test
    void the_records_permission_alone_does_not_open_the_document_control_module() {
        assertThat(docControl(Set.of("documents.form.view_executed_records"))).isEmpty();
    }
}
