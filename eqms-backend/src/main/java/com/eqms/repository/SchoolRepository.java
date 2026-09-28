package com.eqms.repository;

import com.eqms.entity.School;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SchoolRepository extends JpaRepository<School, UUID>, JpaSpecificationExecutor<School> {
    Optional<School> findByNameIgnoreCase(String name);
    List<School> findAllByOrderByNameAsc();
    List<School> findAllByActiveTrueOrderByNameAsc();
    @Query("select distinct s.governingBody from School s where s.governingBody is not null and trim(s.governingBody) <> '' order by s.governingBody")
    List<String> findDistinctGoverningBodies();
    @Query("select distinct s.countryOfOriginName from School s where s.countryOfOriginName is not null and trim(s.countryOfOriginName) <> '' order by s.countryOfOriginName")
    List<String> findDistinctCountryOfOriginNames();
}
