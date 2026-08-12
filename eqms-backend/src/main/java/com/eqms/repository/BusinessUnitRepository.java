package com.eqms.repository;

import com.eqms.entity.BusinessUnit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BusinessUnitRepository extends JpaRepository<BusinessUnit, UUID>, JpaSpecificationExecutor<BusinessUnit> {
    Optional<BusinessUnit> findByName(String name);
    Optional<BusinessUnit> findByNameIgnoreCase(String name);
    Optional<BusinessUnit> findByCode(String code);
    Optional<BusinessUnit> findByCodeIgnoreCase(String code);
    List<BusinessUnit> findAllByOrderByNameAsc();
    List<BusinessUnit> findAllByActiveTrueOrderByNameAsc();
}
