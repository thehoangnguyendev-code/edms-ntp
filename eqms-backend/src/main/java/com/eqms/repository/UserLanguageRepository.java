package com.eqms.repository;

import com.eqms.entity.UserLanguage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserLanguageRepository extends JpaRepository<UserLanguage, UUID> {
    List<UserLanguage> findAllByActiveTrueOrderBySortOrderAscNameAsc();
    Optional<UserLanguage> findByCodeIgnoreCase(String code);
}
