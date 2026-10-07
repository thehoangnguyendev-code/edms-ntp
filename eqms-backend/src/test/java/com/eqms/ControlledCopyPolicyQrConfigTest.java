package com.eqms;

import com.eqms.dto.controlledcopypolicy.ControlledCopyPolicyMarkingSection;
import com.eqms.entity.ControlledCopyPolicySetting;
import com.eqms.service.ControlledCopyPolicyService;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Controlled Copies Policy > PDF Markings > QR code: what the server accepts for the scan code printed on paper copies. */
class ControlledCopyPolicyQrConfigTest {

    private final ControlledCopyPolicyService service =
            new ControlledCopyPolicyService(null, null, null, null, null, null, null, null, null);

    private static ControlledCopyPolicyMarkingSection qr(Boolean enabled, String position, Integer sizeMm) {
        return new ControlledCopyPolicyMarkingSection(
                null, null, null, null, null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, null, null, null,
                enabled, position, sizeMm, null, null, null, null);
    }

    private void apply(ControlledCopyPolicySetting setting, ControlledCopyPolicyMarkingSection marking) {
        ReflectionTestUtils.invokeMethod(service, "applyMarking", setting, marking);
    }

    @Test
    void new_installs_print_a_20mm_code_in_the_bottom_right_corner() {
        ControlledCopyPolicySetting setting = new ControlledCopyPolicySetting();

        assertThat(setting.isQrCodeEnabled()).isTrue();
        assertThat(setting.getQrCodePosition()).isEqualTo("BOTTOM_RIGHT");
        assertThat(setting.getQrCodeSizeMm()).isEqualTo(20);
    }

    @Test
    void valid_values_are_stored() {
        ControlledCopyPolicySetting setting = new ControlledCopyPolicySetting();

        apply(setting, qr(false, "TOP_LEFT", 30));

        assertThat(setting.isQrCodeEnabled()).isFalse();
        assertThat(setting.getQrCodePosition()).isEqualTo("TOP_LEFT");
        assertThat(setting.getQrCodeSizeMm()).isEqualTo(30);
    }

    @Test
    void omitted_values_keep_what_is_stored() {
        ControlledCopyPolicySetting setting = new ControlledCopyPolicySetting();
        setting.setQrCodePosition("TOP_RIGHT");
        setting.setQrCodeSizeMm(25);

        apply(setting, qr(null, null, null));

        assertThat(setting.isQrCodeEnabled()).isTrue();
        assertThat(setting.getQrCodePosition()).isEqualTo("TOP_RIGHT");
        assertThat(setting.getQrCodeSizeMm()).isEqualTo(25);
    }

    @Test
    void a_code_too_small_to_survive_a_photocopy_or_too_large_for_the_page_is_refused() {
        ControlledCopyPolicySetting setting = new ControlledCopyPolicySetting();

        assertThatThrownBy(() -> apply(setting, qr(null, null, 14))).hasMessageContaining("QR code size");
        assertThatThrownBy(() -> apply(setting, qr(null, null, 41))).hasMessageContaining("QR code size");
        assertThatThrownBy(() -> apply(setting, qr(null, null, 0))).hasMessageContaining("QR code size");
        assertThat(setting.getQrCodeSizeMm()).isEqualTo(20);
    }

    @Test
    void only_the_four_corners_are_accepted_as_a_position() {
        ControlledCopyPolicySetting setting = new ControlledCopyPolicySetting();

        assertThatThrownBy(() -> apply(setting, qr(null, "CENTER", null))).hasMessageContaining("QR code position");
        assertThatThrownBy(() -> apply(setting, qr(null, "top_right; drop table", null))).hasMessageContaining("QR code position");
        assertThat(setting.getQrCodePosition()).isEqualTo("BOTTOM_RIGHT");
    }

    private static ControlledCopyPolicyMarkingSection at(Double x, Double y, Boolean reset) {
        return new ControlledCopyPolicyMarkingSection(
                null, null, null, null, null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, null, null, null,
                null, null, null, x, y, reset, null);
    }

    @Test
    void a_dragged_position_is_stored_as_fractions_of_the_page_and_replaces_the_corner() {
        ControlledCopyPolicySetting setting = new ControlledCopyPolicySetting();
        assertThat(setting.getQrCodeX()).isNull();

        apply(setting, at(0.8, 0.9, null));

        assertThat(setting.getQrCodeX()).isEqualTo(0.8);
        assertThat(setting.getQrCodeY()).isEqualTo(0.9);
        // The corner is untouched: it is what a reset returns to.
        assertThat(setting.getQrCodePosition()).isEqualTo("BOTTOM_RIGHT");
    }

    @Test
    void a_reset_puts_the_code_back_in_its_corner() {
        ControlledCopyPolicySetting setting = new ControlledCopyPolicySetting();
        apply(setting, at(0.2, 0.3, null));

        apply(setting, at(null, null, true));

        assertThat(setting.getQrCodeX()).isNull();
        assertThat(setting.getQrCodeY()).isNull();
    }

    @Test
    void a_position_needs_both_values_and_must_stay_on_the_page() {
        ControlledCopyPolicySetting setting = new ControlledCopyPolicySetting();

        assertThatThrownBy(() -> apply(setting, at(0.5, null, null))).hasMessageContaining("both");
        assertThatThrownBy(() -> apply(setting, at(1.2, 0.5, null))).hasMessageContaining("between 0 and 1");
        assertThatThrownBy(() -> apply(setting, at(0.5, -0.1, null))).hasMessageContaining("between 0 and 1");
        assertThatThrownBy(() -> apply(setting, at(Double.NaN, 0.5, null))).hasMessageContaining("between 0 and 1");
        assertThat(setting.getQrCodeX()).isNull();
    }

    @Test
    void omitting_the_position_keeps_the_stored_one() {
        ControlledCopyPolicySetting setting = new ControlledCopyPolicySetting();
        apply(setting, at(0.4, 0.6, null));

        apply(setting, qr(null, null, 25));

        assertThat(setting.getQrCodeX()).isEqualTo(0.4);
        assertThat(setting.getQrCodeY()).isEqualTo(0.6);
    }

    private static ControlledCopyPolicyMarkingSection pages(String qrCodePages) {
        return new ControlledCopyPolicyMarkingSection(
                null, null, null, null, null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, null, null, null,
                null, null, null, null, null, null, qrCodePages);
    }

    @Test
    void the_code_is_on_every_page_unless_the_administrator_chooses_the_first_page_only() {
        ControlledCopyPolicySetting setting = new ControlledCopyPolicySetting();
        assertThat(setting.getQrCodePages()).isEqualTo("ALL");

        apply(setting, pages("FIRST"));
        assertThat(setting.getQrCodePages()).isEqualTo("FIRST");
        apply(setting, pages(null));
        assertThat(setting.getQrCodePages()).isEqualTo("FIRST");
        apply(setting, pages("ALL"));
        assertThat(setting.getQrCodePages()).isEqualTo("ALL");
    }

    @Test
    void any_other_value_for_the_pages_is_refused() {
        ControlledCopyPolicySetting setting = new ControlledCopyPolicySetting();

        org.assertj.core.api.Assertions.assertThatThrownBy(() -> apply(setting, pages("SECOND")))
                .hasMessageContaining("QR code pages");
        assertThat(setting.getQrCodePages()).isEqualTo("ALL");
    }
}
