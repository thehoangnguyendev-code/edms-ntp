package com.eqms.repository;

import com.eqms.entity.EducationDegreeLevel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface EducationDegreeLevelRepository extends JpaRepository<EducationDegreeLevel, UUID>, JpaSpecificationExecutor<EducationDegreeLevel> {
    Optional<EducationDegreeLevel> findByNameIgnoreCase(String name);
    List<EducationDegreeLevel> findAllByOrderByDisplayOrderAscNameAsc();
    List<EducationDegreeLevel> findAllByActiveTrueOrderByDisplayOrderAscNameAsc();
}
