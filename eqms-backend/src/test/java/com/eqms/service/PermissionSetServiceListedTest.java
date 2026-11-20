package com.eqms.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/** Which permission sets a list shows: a managed (ROLE_) set of another profile still grants permissions through the profile it is attached to. */
class PermissionSetServiceListedTest {

    @Test void theSharedListHidesEveryManagedSet() {
        assertThat(PermissionSetService.isListed("PS_DCO_TEST", false, false, null)).isTrue();
        assertThat(PermissionSetService.isListed("ROLE_DCO", false, false, null)).isFalse();
    }

    @Test void theListOfOneProfileHidesOnlyItsOwnManagedSet() {
        assertThat(PermissionSetService.isListed("ROLE_DCO_TEST", false, true, "ROLE_DCO_TEST")).isFalse(); // its direct permissions: the Permissions tab
        assertThat(PermissionSetService.isListed("ROLE_DCO", false, true, "ROLE_DCO_TEST")).isTrue(); // another profile's set that grants through this one
        assertThat(PermissionSetService.isListed("PS_DCO_TEST", false, true, "ROLE_DCO_TEST")).isTrue();
    }

    @Test void aProfileWithNoOwnManagedSetListsEveryAttachedOne() {
        assertThat(PermissionSetService.isListed("ROLE_DCO", false, true, null)).isTrue();
    }

    @Test void includingManagedListsEverything() {
        assertThat(PermissionSetService.isListed("ROLE_DCO", true, false, null)).isTrue();
    }
}
