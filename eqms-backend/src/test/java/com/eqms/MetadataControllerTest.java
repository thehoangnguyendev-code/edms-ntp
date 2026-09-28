package com.eqms;

import com.eqms.controller.MetadataController;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.UserAccessProfileRepository;
import com.eqms.repository.UserAccountRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MetadataControllerTest {

    @Mock UserAccountRepository userAccountRepository;
    @Mock UserAccessProfileRepository userAccessProfileRepository;

    private MetadataController controller;

    @BeforeEach
    void setUp() {
        controller = new MetadataController(userAccountRepository, userAccessProfileRepository);
    }

    @Test
    void pagedLookup_trimsSearch_capsLimit_andReturnsOnlyTheRequestedPage() {
        UserAccount user = new UserAccount();
        user.setId(UUID.randomUUID());
        user.setFullName("Alice QA");
        user.setEmail("alice@example.com");
        PageRequest expectedPage = PageRequest.of(0, 100);
        when(userAccountRepository.findMetadataLookupCandidates(eq(UserStatus.Active), eq("alice@example.com"), eq(null), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(user), expectedPage, 101));
        when(userAccessProfileRepository.findByUserIdInOrderByAssignedAtAsc(List.of(user.getId()))).thenReturn(List.of());

        var response = controller.getUsersLookupPaged(0, 1000, " alice@example.com ", null, "email", "desc").getBody();

        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        verify(userAccountRepository).findMetadataLookupCandidates(eq(UserStatus.Active), eq("alice@example.com"), eq(null), pageable.capture());
        assertThat(pageable.getValue().getPageNumber()).isZero();
        assertThat(pageable.getValue().getPageSize()).isEqualTo(100);
        assertThat(pageable.getValue().getSort().getOrderFor("email").isDescending()).isTrue();
        assertThat(response.pagination().page()).isEqualTo(1);
        assertThat(response.pagination().limit()).isEqualTo(100);
        assertThat(response.pagination().total()).isEqualTo(101);
        assertThat(response.data()).extracting(MetadataController.UserLookupResponse::email).containsExactly("alice@example.com");
    }

    @Test
    void pagedLookup_rejectsUnknownSortField_byFallingBackToFullName() {
        when(userAccountRepository.findMetadataLookupCandidates(eq(UserStatus.Active), eq(null), eq(null), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(), PageRequest.of(0, 10), 0));

        controller.getUsersLookupPaged(1, 10, null, null, "unsafeColumn", "desc");

        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        verify(userAccountRepository).findMetadataLookupCandidates(eq(UserStatus.Active), eq(null), eq(null), pageable.capture());
        assertThat(pageable.getValue().getSort().getOrderFor("fullName").isDescending()).isTrue();
    }

    @Test
    void pagedLookup_passesDepartmentFilterToTheDatabaseQuery() {
        when(userAccountRepository.findMetadataLookupCandidates(eq(UserStatus.Active), eq(null), eq("Quality"), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(), PageRequest.of(0, 10), 0));

        controller.getUsersLookupPaged(1, 10, null, "Quality", "fullName", "asc");

        verify(userAccountRepository).findMetadataLookupCandidates(eq(UserStatus.Active), eq(null), eq("Quality"), any(Pageable.class));
    }
}
