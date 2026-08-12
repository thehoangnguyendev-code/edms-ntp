package com.eqms.util;

import com.eqms.dto.document.StatusResponse;
import com.eqms.entity.DocumentStatusDefinition;
import com.eqms.entity.RevisionStatusDefinition;

public final class StatusMapper {

    private StatusMapper() {
    }

    public static StatusResponse from(DocumentStatusDefinition status) {
        if (status == null) {
            return null;
        }
        return StatusResponse.of(status.getCode(), status.getLabel());
    }

    public static StatusResponse from(RevisionStatusDefinition status) {
        if (status == null) {
            return null;
        }
        return StatusResponse.of(status.getCode(), status.getLabel());
    }

    public static String label(DocumentStatusDefinition status) {
        return status == null ? null : status.getLabel();
    }

    public static String label(RevisionStatusDefinition status) {
        return status == null ? null : status.getLabel();
    }

    public static String code(DocumentStatusDefinition status) {
        return status == null ? null : status.getCode();
    }

    public static String code(RevisionStatusDefinition status) {
        return status == null ? null : status.getCode();
    }
}
