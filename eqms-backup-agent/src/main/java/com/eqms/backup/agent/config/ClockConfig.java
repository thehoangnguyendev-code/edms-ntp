package com.eqms.backup.agent.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;

/** The agent's clock. Time-based checks take it from here, so a test can move time forward without waiting (see ScheduleSimulationTest). */
@Configuration
public class ClockConfig {

    @Bean
    public Clock agentClock() {
        return Clock.systemUTC();
    }
}
