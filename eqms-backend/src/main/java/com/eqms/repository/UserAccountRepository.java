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
    /** Takes the row lock, so two sign-ins of the same account decide their session limit one after the other. */
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from UserAccount u where u.id = :id")
    Optional<UserAccount> findByIdForUpdate(@Param("id") UUID id);

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
    /** The people of a Department who still work there: every account of it except the Terminated ones. */
    long countByDepartmentIdAndStatusNot(java.util.UUID departmentId, UserStatus status);
    /** The people who hold a Position (an account keeps the Position name and its Department): every account except the Terminated ones. */
    long countByPositionAndDepartmentIdAndStatusNot(String position, java.util.UUID departmentId, UserStatus status);
    /** Users whose lockout is still running at {@code now}. */
    long countByLockedUntilAfter(java.time.Instant now);
    java.util.List<UserAccount> findAllByStatus(UserStatus status);
    java.util.List<UserAccount> findAllByStatusOrderByFullNameAsc(UserStatus status);
    java.util.List<UserAccount> findAllByStatusNotAndIdNotOrderByEmployeeCodeAsc(UserStatus status, UUID id);

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
                or lower(u.fullName) like lower(concat('%', cast(:search as string), '%'))
                or lower(coalesce(u.employeeCode, '')) like lower(concat('%', cast(:search as string), '%'))
                or lower(coalesce(u.email, '')) like lower(concat('%', cast(:search as string), '%'))
                or lower(coalesce(u.department, '')) like lower(concat('%', cast(:search as string), '%'))
                or lower(coalesce(u.position, '')) like lower(concat('%', cast(:search as string), '%'))
              )
            """)
    Page<UserAccount> findParticipantCandidates(
            @Param("status") UserStatus status,
            @Param("search") String search,
            Pageable pageable
    );

    /** Database-paged active-user directory for generic person pickers. */
    @Query("""
            select u from UserAccount u
            where u.status = :status
              and (:department is null or lower(coalesce(u.department, '')) = lower(cast(:department as string)))
              and (
                :search is null
                or lower(u.fullName) like lower(concat('%', cast(:search as string), '%'))
                or lower(coalesce(u.email, '')) like lower(concat('%', cast(:search as string), '%'))
                or lower(coalesce(u.employeeCode, '')) like lower(concat('%', cast(:search as string), '%'))
                or lower(coalesce(u.department, '')) like lower(concat('%', cast(:search as string), '%'))
                or lower(coalesce(u.position, '')) like lower(concat('%', cast(:search as string), '%'))
              )
            """)
    Page<UserAccount> findMetadataLookupCandidates(
            @Param("status") UserStatus status,
            @Param("search") String search,
            @Param("department") String department,
            Pageable pageable
    );

    // Status-scoped deliberately: a Controlled Copy distributed by business-unit/department must
    // only resolve to people who could actually receive and use it. Without this filter, a unit
    // with any Suspended/Terminated/Inactive/Pending member would resolve MORE recipients here
    // than the requester's own recipient-count preview (which is Active-only, matching
    // MetadataController's /metadata/users lookup) -- causing every such request to fail
    // server-side with "Sum(recipients.quantity) must equal Request.quantity." even though the
    // requester did nothing wrong.
    @Query("select u from UserAccount u where lower(u.businessUnit) in (lower(:first), lower(:second)) and u.status = :status")
    java.util.List<UserAccount> findAllByBusinessUnitNameOrCodeAndStatus(@Param("first") String first, @Param("second") String second, @Param("status") UserStatus status);

    @Query("select u from UserAccount u where lower(u.department) in (lower(:first), lower(:second)) and u.status = :status")
    java.util.List<UserAccount> findAllByDepartmentNameOrCodeAndStatus(@Param("first") String first, @Param("second") String second, @Param("status") UserStatus status);

    /** User names of the people whose full name contains the text; the backup screens search people by the name they show. */
    @Query("select u.username from UserAccount u where lower(u.fullName) like lower(concat('%', :text, '%'))")
    java.util.List<String> findUsernamesByFullNameContaining(@Param("text") String text);

    @Query("select u from UserAccount u where lower(u.fullName) = lower(:fullName)")
    Optional<UserAccount> findByFullNameIgnoreCase(@Param("fullName") String fullName);

    /** Employee-code-only projection for the New User Employee ID suggestion -- avoids pulling
     *  every enriched column {@link #findAll()}/getUsers() would, since only the code string is
     *  needed to compute the next suggested digits. Includes Terminated users deliberately: their
     *  employeeCode remains uniqueness-constrained, so excluding them could suggest a colliding code. */
    @Query("select u.employeeCode from UserAccount u where u.employeeCode is not null and u.employeeCode <> ''")
    java.util.List<String> findAllEmployeeCodes();
}
