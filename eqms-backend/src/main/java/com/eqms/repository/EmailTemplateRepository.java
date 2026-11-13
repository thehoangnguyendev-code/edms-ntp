package com.eqms.repository;

import com.eqms.entity.EmailTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface EmailTemplateRepository extends JpaRepository<EmailTemplate, UUID>, JpaSpecificationExecutor<EmailTemplate> {
    Optional<EmailTemplate> findByName(String name);

    /** The message with its row locked until the transaction ends (see NotificationPolicyRepository.lockByEventCode). */
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select t from EmailTemplate t where t.id = :id")
    Optional<EmailTemplate> lockById(@org.springframework.data.repository.query.Param("id") UUID id);

    /** The types the messages have, for the Type filter of the list. */
    @org.springframework.data.jpa.repository.Query("select distinct t.type from EmailTemplate t where t.type is not null order by t.type")
    java.util.List<String> findDistinctTypes();
    Optional<EmailTemplate> findTopByTypeIgnoreCaseAndStatusIgnoreCaseOrderByUpdatedDateDesc(String type, String status);
}
