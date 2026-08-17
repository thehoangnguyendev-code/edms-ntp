package com.eqms.repository;

import com.eqms.entity.ControlledCopyPlaceholderField;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ControlledCopyPlaceholderFieldRepository extends JpaRepository<ControlledCopyPlaceholderField, UUID> {
    List<ControlledCopyPlaceholderField> findAllByActiveTrue();
    List<ControlledCopyPlaceholderField> findAllByOrderByCreatedAtDesc();
    Optional<ControlledCopyPlaceholderField> findByFieldKeyIgnoreCase(String fieldKey);
}
