package com.eqms.dto.document;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record StatusResponse(
        String id,
        String name
) {
    public String code() {
        return id;
    }

    public String label() {
        return name;
    }

    public static StatusResponse of(String code, String label) {
        return new StatusResponse(code, label);
    }
}
