package com.eqms.repository;

import com.eqms.entity.Position;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PositionRepository extends JpaRepository<Position, UUID>, JpaSpecificationExecutor<Position> {
    Optional<Position> findByName(String name);
    Optional<Position> findByNameIgnoreCase(String name);
    Optional<Position> findByCode(String code);
    Optional<Position> findByCodeIgnoreCase(String code);
    List<Position> findAllByOrderByNameAsc();
    List<Position> findAllByActiveTrueOrderByNameAsc();
    long countByDepartment_Id(UUID departmentId);
    long countByBusinessUnit_Id(UUID businessUnitId);
}
