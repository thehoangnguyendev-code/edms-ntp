package com.eqms.repository;

import com.eqms.entity.EformFillRun;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface EformFillRunRepository extends JpaRepository<EformFillRun, UUID> {

    Optional<EformFillRun> findByFormDocument_IdAndStatus(UUID formDocumentId, String status);

    Optional<EformFillRun> findByControlledCopy_IdAndStatus(UUID controlledCopyId, String status);
}
