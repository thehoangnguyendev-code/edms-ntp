package com.eqms;

import com.eqms.service.SeparationRuleSwitch;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

/** The people-lists of Training follow the rule switches; a failure of the lookup keeps the person apart (never looser than the rule). */
@ExtendWith(MockitoExtension.class)
class SeparationRuleSwitchTest {
    @Mock private JdbcTemplate jdbc;

    @Test
    void aRuleWithAnActiveForbiddenRelationIsOn() {
        when(jdbc.queryForObject(anyString(), eq(Integer.class), eq("T"), eq("A"), eq("R"))).thenReturn(1);
        assertTrue(SeparationRuleSwitch.isOn(jdbc, "T", "A", "R"));
    }

    @Test
    void aRuleWithoutOneIsOff() {
        when(jdbc.queryForObject(anyString(), eq(Integer.class), eq("T"), eq("A"), eq("R"))).thenReturn(0);
        assertFalse(SeparationRuleSwitch.isOn(jdbc, "T", "A", "R"));
    }

    @Test
    void aFailureOfTheLookupAnswersOnSoThePersonStaysKeptApart() {
        when(jdbc.queryForObject(anyString(), eq(Integer.class), eq("T"), eq("A"), eq("R"))).thenThrow(new IllegalStateException("database down"));
        assertTrue(SeparationRuleSwitch.isOn(jdbc, "T", "A", "R"));
    }
}
