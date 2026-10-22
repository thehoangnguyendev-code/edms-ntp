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

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * The sidebar shows only what the server lists. A Training menu that the front end declares but the server does not list appears while the menu loads and
 * then disappears, so every Training menu of the front end must be listed here for the permission that opens it.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TrainingNavigationTest {

    @Mock private SystemConfigurationService systemConfigurationService;
    private NavigationService navigation;

    @BeforeEach
    void setUp() {
        when(systemConfigurationService.isFeatureEnabled(any())).thenReturn(true);
        navigation = new NavigationService(systemConfigurationService);
    }

    private static void collect(List<NavigationItemResponse> items, List<String> ids) {
        for (NavigationItemResponse item : items) {
            ids.add(item.id());
            if (item.children() != null) collect(item.children(), ids);
        }
    }

    private List<String> idsFor(String... permissions) {
        List<String> ids = new ArrayList<>();
        collect(navigation.getNavigation(Set.of(permissions)), ids);
        return ids;
    }

    @Test
    void trainingReviewsIsListedForAPersonWhoMaySeeJobAssignments() {
        assertThat(idsFor("training.module.view", "training.job_assignment.view")).contains("training-job-assignments", "training-personnel-reviews");
    }

    @Test
    void trainingReviewsIsNotListedWithoutThatPermission() {
        assertThat(idsFor("training.module.view", "training.self.view")).doesNotContain("training-personnel-reviews");
    }
}
