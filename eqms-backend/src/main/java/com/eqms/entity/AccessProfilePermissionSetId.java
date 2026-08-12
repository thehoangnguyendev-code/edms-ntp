package com.eqms.entity;

import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

public class AccessProfilePermissionSetId implements Serializable {
    private UUID accessProfileId;
    private UUID permissionSetId;

    public AccessProfilePermissionSetId() {}
    public AccessProfilePermissionSetId(UUID accessProfileId, UUID permissionSetId) {
        this.accessProfileId = accessProfileId;
        this.permissionSetId = permissionSetId;
    }

    @Override public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof AccessProfilePermissionSetId that)) return false;
        return Objects.equals(accessProfileId, that.accessProfileId) && Objects.equals(permissionSetId, that.permissionSetId);
    }
    @Override public int hashCode() { return Objects.hash(accessProfileId, permissionSetId); }
}
