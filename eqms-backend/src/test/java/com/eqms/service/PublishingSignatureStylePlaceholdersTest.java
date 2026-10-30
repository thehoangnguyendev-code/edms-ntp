package com.eqms.service;

import com.eqms.dto.publishing.PublishingPlaceholderGroupResponse;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** The signature placeholders of the catalog of Publishing Templates: three groups (Compact, Standard, Detailed) of four, and each is read as its style. */
class PublishingSignatureStylePlaceholdersTest {

    private List<PublishingPlaceholderGroupResponse> groups() {
        return new PublishingPlaceholderCatalogService().getAvailablePlaceholders(null).groups();
    }

    @Test
    void theCatalogListsOnlyThreeGroupsOfFourSignaturePlaceholders() {
        var signatureGroups = groups().stream().filter(g -> g.title().startsWith("Signature - ")).toList();

        assertThat(signatureGroups).extracting(PublishingPlaceholderGroupResponse::title)
                .containsExactly("Signature - Compact", "Signature - Standard", "Signature - Detailed", "Signature - Several Reviewers or Approvers");
        assertThat(signatureGroups.subList(0, 3)).allSatisfy(g -> assertThat(g.items()).hasSize(4));
        assertThat(signatureGroups.get(3).items()).extracting(i -> i.value()).containsExactly("{{REVIEWER_SIGNATURES_COMPACT}}", "{{APPROVER_SIGNATURES_COMPACT}}",
                "{{REVIEWER_SIGNATURES_STANDARD}}", "{{APPROVER_SIGNATURES_STANDARD}}", "{{REVIEWER_SIGNATURES_DETAILED}}", "{{APPROVER_SIGNATURES_DETAILED}}");
        assertThat(signatureGroups.get(0).items()).extracting(i -> i.value())
                .containsExactly("{{PREPARED_SIGNATURE_COMPACT}}", "{{REVIEWED_SIGNATURE_COMPACT}}", "{{APPROVED_SIGNATURE_COMPACT}}", "{{PUBLISHED_SIGNATURE_COMPACT}}");
    }

    @Test
    void noSignaturePlaceholderWithoutAStyleIsListedAnyMore() {
        var values = groups().stream().flatMap(g -> g.items().stream()).map(i -> i.value()).toList();

        assertThat(values.stream().filter(v -> v.toUpperCase().contains("SIGNATURE")).toList()).hasSize(18)
                .allSatisfy(v -> assertThat(SignatureDisplayStyle.ofName(v.substring(2, v.length() - 2))).as(v).isNotNull());
    }

    @Test
    void everyListedPlaceholderIsReadAsItsStyleAndItsBaseNameIsTheOrdinaryPlaceholder() {
        for (var group : groups().stream().filter(g -> g.title().startsWith("Signature - ")).toList()) {
            for (var item : group.items()) {
                String name = item.value().substring(2, item.value().length() - 2);
                SignatureDisplayStyle style = SignatureDisplayStyle.ofName(name);
                assertThat(style).as(name).isNotNull();
                assertThat(name).endsWith(style.name());
                assertThat(SignatureDisplayStyle.baseName(name)).as(name).containsPattern("_SIGNATURES?$");
            }
        }
    }

    @Test
    void theSearchOfTheCatalogFindsThem() {
        var found = new PublishingPlaceholderCatalogService().getAvailablePlaceholders("approved_signature_compact");
        assertThat(found.groups()).hasSize(1);
        assertThat(found.groups().get(0).items()).extracting(i -> i.value()).containsExactly("{{APPROVED_SIGNATURE_COMPACT}}");
    }
}
