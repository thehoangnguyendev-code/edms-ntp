package com.eqms.repository;

import com.eqms.entity.ElectronicSignatureMeaning;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ElectronicSignatureMeaningRepository extends JpaRepository<ElectronicSignatureMeaning, UUID> {
    List<ElectronicSignatureMeaning> findAllByOrderByCodeAsc();
    Optional<ElectronicSignatureMeaning> findByCodeIgnoreCase(String code);
    List<ElectronicSignatureMeaning> findByCodeContainingIgnoreCaseOrDisplayNameContainingIgnoreCaseOrderByCodeAsc(
            String codeSearch, String displayNameSearch);
}
