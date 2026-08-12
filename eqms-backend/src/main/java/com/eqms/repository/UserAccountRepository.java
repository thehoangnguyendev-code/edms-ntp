package com.eqms.repository;

import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface UserAccountRepository extends JpaRepository<UserAccount, UUID>, JpaSpecificationExecutor<UserAccount> {
    Optional<UserAccount> findByUsername(String username);
    Optional<UserAccount> findByUsernameIgnoreCase(String username);
    Optional<UserAccount> findByEmail(String email);
    Optional<UserAccount> findByEmailIgnoreCase(String email);
    Optional<UserAccount> findByEmployeeCode(String employeeCode);
    long countByRoleName(String roleName);

    @Modifying
    @Query("update UserAccount u set u.roleName = :newRoleName where u.roleName = :previousRoleName")
    int replaceRoleName(@Param("previousRoleName") String previousRoleName, @Param("newRoleName") String newRoleName);
    long countByStatus(UserStatus status);
    java.util.List<UserAccount> findAllByStatus(UserStatus status);
    java.util.List<UserAccount> findAllByStatusOrderByFullNameAsc(UserStatus status);

    /**
     * Database-backed candidate lookup for workflow participant typeaheads.  Permission,
     * object-scope and segregation-of-duties checks deliberately remain in the service,
     * because they are resource-specific authorization decisions.
     */
    @Query("""
            select u from UserAccount u
            where u.status = :status
              and (
                :search is null
                or lower(u.fullName) like lower(concat('%', :search, '%'))
                or lower(coalesce(u.employeeCode, '')) like lower(concat('%', :search, '%'))
                or lower(coalesce(u.department, '')) like lower(concat('%', :search, '%'))
                or lower(coalesce(u.position, '')) like lower(concat('%', :search, '%'))
              )
            """)
    Page<UserAccount> findParticipantCandidates(
            @Param("status") UserStatus status,
            @Param("search") String search,
            Pageable pageable
    );

    @Query("select u from UserAccount u where lower(u.businessUnit) in (lower(:first), lower(:second))")
    java.util.List<UserAccount> findAllByBusinessUnitNameOrCode(@Param("first") String first, @Param("second") String second);

    @Query("select u from UserAccount u where lower(u.department) in (lower(:first), lower(:second))")
    java.util.List<UserAccount> findAllByDepartmentNameOrCode(@Param("first") String first, @Param("second") String second);

    @Query("select u from UserAccount u where lower(u.fullName) = lower(:fullName)")
    Optional<UserAccount> findByFullNameIgnoreCase(@Param("fullName") String fullName);
}
