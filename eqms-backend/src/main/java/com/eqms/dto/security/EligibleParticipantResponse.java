package com.eqms.dto.security;
import java.util.UUID;
public record EligibleParticipantResponse(UUID userId, String fullName, String employeeCode, String department, String participantType) {}
