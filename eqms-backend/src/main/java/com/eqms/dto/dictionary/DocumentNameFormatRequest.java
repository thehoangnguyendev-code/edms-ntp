package com.eqms.dto.dictionary;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

import java.util.List;
import java.util.UUID;

public record DocumentNameFormatRequest(
        @NotBlank String name,
        // Deliberately narrow -- see DocumentNameFormat#separator javadoc. Empty separator (two
        // components run together with nothing between them) is allowed; anything containing a
        // letter/digit is not, since that would be indistinguishable from a component's own value.
        @NotNull @Pattern(regexp = "^[^A-Za-z0-9]{0,10}$", message = "Separator must be 0-10 non-alphanumeric characters")
        String separator,
        String description,
        Boolean isActive,
        @NotEmpty List<@Valid ComponentRef> components
) {
    public record ComponentRef(
            @NotNull UUID componentId,
            @NotNull Integer displayOrder
    ) {
    }
}
