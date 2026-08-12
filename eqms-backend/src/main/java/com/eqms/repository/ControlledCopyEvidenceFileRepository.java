package com.eqms.repository;

import com.eqms.entity.ControlledCopyEvidenceFile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ControlledCopyEvidenceFileRepository extends JpaRepository<ControlledCopyEvidenceFile, UUID> {
    List<ControlledCopyEvidenceFile> findAllByControlledCopy_IdOrderByUploadedAtAsc(UUID controlledCopyId);
    Optional<ControlledCopyEvidenceFile> findByIdAndControlledCopy_Id(UUID id, UUID controlledCopyId);
}
