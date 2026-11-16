package com.eqms.service.export;

import com.eqms.auth.CurrentUserService;
import com.eqms.entity.UserAccount;
import com.eqms.repository.UserAccountRepository;
import com.eqms.service.UserManagementService;
import com.eqms.util.DateTimeFormatUtils;
import jakarta.persistence.criteria.*;
import org.junit.jupiter.api.*;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.test.util.ReflectionTestUtils;
import java.time.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class UserTableExportQueryTest {
    UserManagementService service=mock(UserManagementService.class,CALLS_REAL_METHODS);
    UserAccountRepository repository=mock(UserAccountRepository.class);
    CurrentUserService current=mock(CurrentUserService.class);
    @BeforeEach void setup() {
        ReflectionTestUtils.setField(service,"userRepository",repository);
        ReflectionTestUtils.setField(service,"currentUserService",current);
        when(current.requireCurrentUser()).thenReturn(new UserAccount());
    }
    @SuppressWarnings("unchecked")
    @Test void lastUpdatedRangeAndSortExecuteInTheSameRepositoryQueryAsTheRegister() {
        when(repository.findAll(any(Specification.class),any(Pageable.class))).thenReturn(Page.empty());
        service.getUsers(1,500,null,null,null,null,null,null,null,null,null,null,null,null,null,"lastUpdated","asc",false,"2026-11-01","2026-11-14");
        var spec=ArgumentCaptor.forClass(Specification.class);
        var pageable=ArgumentCaptor.forClass(Pageable.class);
        verify(repository).findAll(spec.capture(),pageable.capture());
        assertThat(pageable.getValue().getSort().getOrderFor("updatedAt")).isNotNull();
        assertThat(pageable.getValue().getSort().getOrderFor("id")).isNotNull();
        Root<UserAccount> root=mock(Root.class);
        Path<Instant> updated=mock(Path.class);
        when(root.<Instant>get("updatedAt")).thenReturn(updated);
        CriteriaBuilder cb=mock(CriteriaBuilder.class);
        spec.getValue().toPredicate(root,mock(CriteriaQuery.class),cb);
        verify(cb).greaterThanOrEqualTo(updated,LocalDate.of(2026,11,1).atStartOfDay(DateTimeFormatUtils.ZONE).toInstant());
        verify(cb).lessThan(updated,LocalDate.of(2026,11,15).atStartOfDay(DateTimeFormatUtils.ZONE).toInstant());
    }
    @Test void invalidOrReversedUpdatedRangeDoesNotSilentlyExportEveryUser() {
        assertThatThrownBy(()->service.getUsers(1,500,null,null,null,null,null,null,null,null,null,null,null,null,null,"lastUpdated","asc",false,"2026-11-15","2026-11-01"))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("Last Updated");
        assertThatThrownBy(()->service.getUsers(1,500,null,null,null,null,null,null,null,null,null,null,null,null,null,"lastUpdated","asc",false,"invalid",null))
                .isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(repository);
    }
}
