package com.eqms.repository;

import com.eqms.entity.StorageLocation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface StorageLocationRepository extends JpaRepository<StorageLocation, UUID>, JpaSpecificationExecutor<StorageLocation> {
    Optional<StorageLocation> findByName(String name);
    Optional<StorageLocation> findByNameIgnoreCase(String name);
    List<StorageLocation> findAllByOrderByNameAsc();
}
