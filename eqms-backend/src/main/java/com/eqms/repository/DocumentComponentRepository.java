package com.eqms.repository;

import com.eqms.entity.DocumentComponent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DocumentComponentRepository extends JpaRepository<DocumentComponent, UUID>, JpaSpecificationExecutor<DocumentComponent> {
    List<DocumentComponent> findAllByOrderByDisplayOrderAscNameAsc();
    List<DocumentComponent> findAllByActiveTrueOrderByDisplayOrderAscNameAsc();
    Optional<DocumentComponent> findByNameIgnoreCase(String name);
    Optional<DocumentComponent> findByValueIgnoreCase(String value);
}
