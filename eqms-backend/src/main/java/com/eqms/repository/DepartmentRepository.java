package com.eqms.repository;

import com.eqms.entity.Department;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DepartmentRepository extends JpaRepository<Department, UUID>, JpaSpecificationExecutor<Department> {
    Optional<Department> findByName(String name);
    Optional<Department> findByNameIgnoreCase(String name);
    Optional<Department> findByCode(String code);
    Optional<Department> findByCodeIgnoreCase(String code);
    List<Department> findAllByOrderByNameAsc();

    /** The Departments whose Department Head is this user (a user may head several). */
    List<Department> findAllByDepartmentHead_Id(java.util.UUID userId);
    List<Department> findAllByActiveTrueOrderByNameAsc();
    long countByBusinessUnit_Id(UUID businessUnitId);
    List<Department> findAllByBusinessUnit_Id(UUID businessUnitId);
}
