package com.eqms.dto.system;

import java.time.Instant;

/** One service the application leans on and whether it answers now. {@code status} is UP or DOWN; {@code impact} says what stops working while it is down. No address is given. */
public record DependencyStatus(String code, String name, String status, String impact, Instant checkedAt) {}
