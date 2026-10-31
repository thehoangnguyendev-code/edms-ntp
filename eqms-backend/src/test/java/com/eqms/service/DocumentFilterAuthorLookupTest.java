package com.eqms.service;

import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.UserAccountRepository;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.test.util.ReflectionTestUtils;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class DocumentFilterAuthorLookupTest {
    @Test void searchIsBoundedAtServerAndSelectedActivePeopleRemainVisible() {
        var users=mock(UserAccountRepository.class);
        var service=mock(DocumentService.class,CALLS_REAL_METHODS);
        ReflectionTestUtils.setField(service,"userAccountRepository",users);
        var selected=new UserAccount();selected.setId(UUID.randomUUID());selected.setFullName("Selected Author");selected.setStatus(UserStatus.Active);
        var inactive=new UserAccount();inactive.setId(UUID.randomUUID());inactive.setStatus(UserStatus.Inactive);
        when(users.findParticipantCandidates(eq(UserStatus.Active),isNull(),any())).thenAnswer(call->{
            Pageable page=call.getArgument(2); assertEquals(30,page.getPageSize());assertEquals(0,page.getPageNumber());
            return new PageImpl<UserAccount>(List.of());
        });
        when(users.findAllById(any())).thenReturn(List.of(selected,inactive));
        var result=service.getFilterAuthors(null,List.of(selected.getId(),inactive.getId()));
        assertEquals(1,result.size());assertEquals("Selected Author",result.getFirst().label());
        verify(users,never()).findAllByStatusOrderByFullNameAsc(any());
    }

    @Test void abusiveSearchAndSelectedIdListAreRejectedBeforeQuerying() {
        var users=mock(UserAccountRepository.class);
        var service=mock(DocumentService.class,CALLS_REAL_METHODS);
        ReflectionTestUtils.setField(service,"userAccountRepository",users);
        assertThrows(IllegalArgumentException.class,()->service.getFilterAuthors("x".repeat(201),List.of()));
        assertThrows(IllegalArgumentException.class,()->service.getFilterAuthors(null,Collections.nCopies(11,UUID.randomUUID())));
        verifyNoInteractions(users);
    }
}
