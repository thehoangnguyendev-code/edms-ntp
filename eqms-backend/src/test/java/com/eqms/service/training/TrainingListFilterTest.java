package com.eqms.service.training;

import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** The shared where clause of the Training lists: blank filters add nothing, values travel as parameters, ranges include both days, a bad date is refused. */
class TrainingListFilterTest {

    @Test
    void blankFiltersAddNothing() {
        TrainingListFilter f = new TrainingListFilter().equal("r.kind", " ").equal("r.x", (Object) null).contains("  ", "r.a").dateRange("r.d", "", null).timeRange("r.t", null, " ");

        assertThat(f.where()).isEqualTo(" where 1=1");
        assertThat(f.args()).isEmpty();
    }

    @Test
    void valuesAreParametersAndNeverPartOfTheSql() {
        UUID id = UUID.randomUUID();
        TrainingListFilter f = new TrainingListFilter().equal("r.status", "DRAFT'; drop table x; --").equal("r.department_id", id).contains("50%_off", "u.full_name", "r.reason");

        assertThat(f.where()).doesNotContain("drop table").doesNotContain("50%");
        assertThat(f.where()).contains("r.status = ?").contains("r.department_id = ?").contains("lower(coalesce(u.full_name::text,'')) like ? escape");
        assertThat(f.args()).hasSize(4).contains(id).contains("%50\\%\\_off%");
    }

    @Test
    void aDateRangeIncludesBothDaysAndATimeRangeEndsAtTheEndOfTheLastDay() {
        TrainingListFilter f = new TrainingListFilter().dateRange("r.due_by", "2026-10-01", "2026-10-31").timeRange("r.created_at", "2026-10-01", "2026-10-31");

        assertThat(f.where()).contains("r.due_by >= ?").contains("r.due_by <= ?").contains("r.created_at >= ?").contains("r.created_at < ?");
        assertThat(f.args()).hasSize(4);
        assertThat(((java.sql.Timestamp) f.args().get(3)).toInstant()).isAfter(((java.sql.Timestamp) f.args().get(2)).toInstant().plusSeconds(30L * 24 * 3600));
    }

    @Test
    void aMalformedDateIsRefusedInsteadOfIgnored() {
        assertThatThrownBy(() -> new TrainingListFilter().dateRange("r.d", "31/10/2026", null)).isInstanceOf(IllegalArgumentException.class).hasMessage("TRAINING_DATE_INVALID");
        assertThatThrownBy(() -> new TrainingListFilter().timeRange("r.t", null, "tomorrow")).isInstanceOf(IllegalArgumentException.class).hasMessage("TRAINING_DATE_INVALID");
    }

    @Test
    void theConditionsCanBeAppendedToAWhereThatIsAlreadyBegun() {
        assertThat(new TrainingListFilter().equal("r.kind", "ANNUAL").and()).isEqualTo(" and r.kind = ?");
    }
}
