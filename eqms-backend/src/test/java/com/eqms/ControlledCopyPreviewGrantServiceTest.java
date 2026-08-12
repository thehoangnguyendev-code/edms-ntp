package com.eqms;

import com.eqms.entity.ControlledCopyRecord;
import com.eqms.service.ControlledCopyPreviewGrantService;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ControlledCopyPreviewGrantServiceTest {

    private final ControlledCopyPreviewGrantService service =
            new ControlledCopyPreviewGrantService("test-secret-with-at-least-32-characters");

    @Test
    void issuedGrantIsBoundToTheSameControlledCopy() {
        ControlledCopyRecord copy = copy();

        String grant = service.issue(copy);

        assertThatCode(() -> service.require(copy, grant)).doesNotThrowAnyException();
    }

    @Test
    void issuedGrantCannotBeUsedForAnotherControlledCopy() {
        ControlledCopyRecord source = copy();
        ControlledCopyRecord another = copy();

        String grant = service.issue(source);

        assertThatThrownBy(() -> service.require(another, grant))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void rawEmailTokenIsNotAcceptedAsPreviewSessionGrant() {
        assertThatThrownBy(() -> service.require(copy(), "long-lived-email-token"))
                .isInstanceOf(AccessDeniedException.class);
    }

    private ControlledCopyRecord copy() {
        ControlledCopyRecord copy = new ControlledCopyRecord();
        copy.setId(UUID.randomUUID());
        return copy;
    }
}
