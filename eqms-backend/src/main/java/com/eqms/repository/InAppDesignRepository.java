package com.eqms.repository;

import com.eqms.entity.InAppDesign;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;
import java.util.UUID;

public interface InAppDesignRepository extends JpaRepository<InAppDesign, UUID> {

    /** The one row, locked until the transaction ends: two administrators saving the design are served one after the other, and the second sees the first. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select d from InAppDesign d order by d.updatedAt desc limit 1")
    Optional<InAppDesign> lockCurrent();
}
