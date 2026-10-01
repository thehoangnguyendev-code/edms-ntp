package com.eqms.repository;

import com.eqms.entity.EformSignerAssignment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface EformSignerAssignmentRepository extends JpaRepository<EformSignerAssignment, UUID> {

    List<EformSignerAssignment> findAllByControlledCopy_IdOrderBySequenceAsc(UUID controlledCopyId);
}
