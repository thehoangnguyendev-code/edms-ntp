package com.eqms.service.training;

import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTP;

import java.util.ArrayList;
import java.util.List;

import static com.eqms.service.training.TrainingAnnexData.Item;

/**
 * Sample data of each APD: what the preview of a template shows when no real object is chosen, and what the tests fill the tokenized files with. The names and the numbers are invented and
 * every output made from them is marked as a preview, never as a record.
 */
public final class TrainingAnnexSamples {
    private TrainingAnnexSamples() {}

    private static final List<String> SIGNED = List.of("Signed electronically: Nguyen Van A", "2026-10-28 09:30 (UTC+7)", "Meaning: sample");

    public static TrainingAnnexData of(String code) {
        TrainingAnnexData d = new TrainingAnnexData().scalar("FORM_CODE", code).scalar("FORM_REVISION", "SAMPLE").scalar("GENERATED_AT", "PREVIEW - sample data, not a record");
        switch (code) {
            case "APD.0117" -> {
                List<Item> sessions = new ArrayList<>();
                for (int s = 1; s <= 2; s++) {
                    List<Item> people = new ArrayList<>();
                    for (int i = 1; i <= 3; i++) {
                        people.add(new Item().field("NO", String.valueOf(i)).field("CODE", "E00" + i).field("NAME", "Employee " + i).field("DEPARTMENT", "QA")
                                .field("RESULT", i == 3 ? "Not passed" : "Passed").field("RETRAINING_RESULT", i == 3 ? "Passed" : "").signature("ATTENDANCE", SIGNED));
                    }
                    sessions.add(new Item().field("LABEL", "SS0" + s).children("ATTENDEE", people));
                }
                d.scalar("TRAINING_NUMBER", "TRN-2026-0001").scalar("ACTIVITY_CONTENT", "GMP refresher").scalar("DEPARTMENT", "QA").scalar("TRAINING_TYPE", "Periodic")
                        .scalar("LIST_PREPARER_NAME", "Tran Thi B").scalar("QA_CONFIRMER_NAME", "Le Van C")
                        .group("TOPIC", List.of(new Item().field("SESSION_NO", "SS01").field("DOCUMENT_NUMBER", "SOP.0003").field("TITLE", "Training").field("MODE", "Classroom")
                                .field("TRAINER", "Pham D").field("EXECUTION_DATE", "2026-10-20"),
                                new Item().field("SESSION_NO", "SS02").field("DOCUMENT_NUMBER", "SOP.0005").field("TITLE", "Deviation").field("MODE", "Online")
                                        .field("TRAINER", "Pham D").field("EXECUTION_DATE", "2026-10-21")))
                        .group("SESSION", sessions)
                        .group("TRAINER", List.of(new Item().field("SESSION_NO", "SS01").field("NAME", "Pham D").signature("SENT", SIGNED),
                                new Item().field("SESSION_NO", "SS02").field("NAME", "Pham D").signature("SENT", SIGNED)))
                        .caseOn("EXTERNAL", false).signature("LIST_PREPARED", SIGNED).signature("QA_COMPLETION", SIGNED);
            }
            case "APD.0108" -> d.scalar("DEPARTMENT", "Production").scalar("DOCUMENT_NAME_VERSION", "SOP.0010 Cleaning (2.0)").scalar("HEAD_NAME", "Hoang E")
                    .scalar("HEAD_POSITION", "Head of production").scalar("HEAD_DATE", "2026-10-25").scalar("HEAD_REMARKS", "No remark")
                    .group("READER", List.of(new Item().field("NO", "1").field("CODE", "E001").field("NAME", "Employee 1").field("TRAINING_NUMBER", "TRN-2026-0002")
                            .field("DATE", "2026-10-22").signature("CONFIRMED", SIGNED),
                            new Item().field("NO", "2").field("CODE", "E002").field("NAME", "Employee 2").field("TRAINING_NUMBER", "TRN-2026-0002")
                                    .field("DATE", "2026-10-23").signature("CONFIRMED", SIGNED)))
                    .signature("HEAD", SIGNED);
            case "APD.0118" -> d.scalar("YEAR", "2026").scalar("REQUEST_NO", "REQ-2026-01").check("KIND_PERIODIC_SOP", true).check("KIND_ANNUAL", false)
                    .group("LINE", List.of(new Item().field("NO", "1").field("MONTH", "03").field("TOPIC", "GMP basics").field("CODE", "TRN-2026-0001")
                            .field("EXECUTION_DATE", "2026-03-10").field("QA_COMMENT", "Done").signature("QA", SIGNED),
                            new Item().field("NO", "2").field("MONTH", "06").field("TOPIC", "Data integrity").field("CODE", "").field("EXECUTION_DATE", "")
                                    .field("QA_COMMENT", "").signature("QA", List.of())))
                    .signature("PREPARED", SIGNED).signature("REVIEWED", SIGNED).signature("APPROVED", SIGNED);
            case "APD.0011" -> d.scalar("DEPARTMENT", "Quality Assurance").scalar("MATRIX_CODE", "TRM-QA").scalar("MATRIX_VERSION", "2 (Effective)").signature("MATRIX", SIGNED).block("MATRIX", (doc, marker) -> {
                CTP p = (CTP) TrainingWordForms.copyAfter(marker, marker);
                TrainingWordForms.setCtText(p, "(the table of the training matrix is drawn here by the system)");
            });
            case "APD.0024" -> d.scalar("EMPLOYEE_CODE", "E001").scalar("EMPLOYEE_NAME", "Employee 1").scalar("ISSUANCE_NO", "1").scalar("MATRIX_CODE_VERSION", "APD.0011 (2.0)")
                    .scalar("JURISDICTION", "Release of intermediate product").scalar("ASSIGNOR_TITLE", "Head of QA").scalar("DEPARTMENT", "QA").scalar("POSITION", "Specialist")
                    .scalar("SUPERIOR", "Head of QA").scalar("SUBORDINATES", "None").scalar("SUBSTITUTE", "Employee 2").scalar("CURRENT_POSITION", "Specialist (QA)")
                    .scalar("CHANGE_REASON", "Promotion").scalar("NEW_POSITION", "Senior specialist (QA)")
                    .check("CASE_INITIAL", true).check("CASE_CHANGE", false).caseOn("INITIAL", true).caseOn("CHANGE", false)
                    .group("DUTY", List.of(new Item().field("RESPONSIBILITY", "Batch records").field("DESCRIPTION", "Review"), new Item().field("RESPONSIBILITY", "Deviations").field("DESCRIPTION", "Investigate")))
                    .signature("ASSIGNOR", SIGNED).signature("RECEIVER", SIGNED);
            case "APD.0014" -> d.scalar("EMPLOYEE_CODE", "E001").scalar("EMPLOYEE_NAME", "Employee 1").scalar("QUALIFICATION", "Pharmacist").scalar("JOIN_DATE", "2024-01-15")
                    .scalar("PREPARED_DATE", "2026-10-28").scalar("APPROVED_DATE", "2026-10-28")
                    .group("RECORD", List.of(new Item().field("CONTENT", "SOP.0003 (2.0)").field("DATE", "2026-02-01").field("NUMBER", "TRN-2026-0001"),
                            new Item().field("CONTENT", "GMP refresher").field("DATE", "2026-03-10").field("NUMBER", "TRN-2026-0004")))
                    .signature("PREPARED", SIGNED).signature("APPROVED", SIGNED);
            default -> throw new IllegalArgumentException("TRAINING_ANNEX_CODE_UNKNOWN");
        }
        return d;
    }
}
