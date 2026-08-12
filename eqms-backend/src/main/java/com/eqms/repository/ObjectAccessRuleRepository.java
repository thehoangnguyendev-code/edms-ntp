package com.eqms.repository;

import com.eqms.entity.ObjectAccessRule;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ObjectAccessRuleRepository extends JpaRepository<ObjectAccessRule, UUID> {
    List<ObjectAccessRule> findAllByOrderByPriorityDescNameAsc();
    List<ObjectAccessRule> findAllByActiveOrderByPriorityDescNameAsc(boolean active);
}
