package com.eqms.service.training;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * When a training activity needs Training Materials and an Assessment form before it may go on (SOP.0003 5.1.2, 5.3.5; PLAN-TR-002).
 *
 * <ul>
 *   <li>Materials: the training that comes from a document of Document Control takes the approved document as its material; any other training needs a file or a link of content.
 *       An external training, a visitor, a supplementary training (it keeps the content of the activity it supplements) and an activity the organizer exempted need none.</li>
 *   <li>Assessment form: a session assessed by a Test needs the test (APD.0009, as a file or written in the system); a session assessed by a Checklist needs the checklist form. Observation and self-reading confirmation
 *       need no file. The same exemptions apply.</li>
 * </ul>
 * The rules are a pure function of the facts so that every case of the plan can be tested without a database.
 */
public final class TrainingContentRules {

    public static final String MATERIALS_REQUIRED = "TRAINING_MATERIALS_REQUIRED";
    public static final String TEST_REQUIRED = "TRAINING_TEST_REQUIRED";
    public static final String CHECKLIST_REQUIRED = "TRAINING_CHECKLIST_REQUIRED";

    private TrainingContentRules() {
    }

    /** What the rules look at. {@code sessionAssessments} are the assessment methods of the sessions that are not cancelled. */
    public record Facts(String kind, String kindReason, boolean supplementary, boolean documentLinked, int contentFiles, int assessmentForms, int onlineTestQuestions,
                        List<String> sessionAssessments, boolean materialsExempt, boolean assessmentExempt) {
    }

    public record Result(boolean materialsRequired, boolean materialsSatisfied, String materialsSource, boolean testRequired, boolean checklistRequired,
                         boolean assessmentFormSatisfied, boolean onlineTest, boolean inherited, List<String> missing) {
        public boolean complete() {
            return missing.isEmpty();
        }

        public Map<String, Object> toMap() {
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("materialsRequired", materialsRequired);
            out.put("materialsSatisfied", materialsSatisfied);
            out.put("materialsSource", materialsSource);
            out.put("testRequired", testRequired);
            out.put("checklistRequired", checklistRequired);
            out.put("assessmentFormSatisfied", assessmentFormSatisfied);
            out.put("onlineTest", onlineTest);
            out.put("inherited", inherited);
            out.put("missing", missing);
            return out;
        }
    }

    public static Result evaluate(Facts f) {
        boolean external = "EXTERNAL".equals(f.kind());
        boolean visitor = "VISITOR".equals(f.kindReason());
        // A supplementary training keeps the content and the test of the activity it supplements (SOP.0003 5.3.7: the retraining is recorded in the assessment of the employee).
        boolean freeByRule = external || visitor || f.supplementary();

        boolean materialsRequired = !freeByRule && !f.materialsExempt();
        boolean materialsSatisfied = f.documentLinked() || f.contentFiles() > 0;
        String source = f.documentLinked() ? "DOCUMENT" : f.contentFiles() > 0 ? "FILES" : "NONE";

        boolean assessmentNeeded = !freeByRule && !f.assessmentExempt();
        List<String> assessments = f.sessionAssessments() == null ? List.of() : f.sessionAssessments();
        boolean testRequired = assessmentNeeded && assessments.contains("TEST");
        boolean checklistRequired = assessmentNeeded && assessments.contains("CHECKLIST");
        boolean formSatisfied = f.assessmentForms() > 0;
        // The test can also be written in the system ("Test in the system"): its questions are the test, no file is needed then. A checklist is always a form.
        boolean onlineTest = f.onlineTestQuestions() > 0;

        List<String> missing = new ArrayList<>();
        if (materialsRequired && !materialsSatisfied) missing.add(MATERIALS_REQUIRED);
        if (testRequired && !formSatisfied && !onlineTest) missing.add(TEST_REQUIRED);
        else if (checklistRequired && !formSatisfied) missing.add(CHECKLIST_REQUIRED);
        return new Result(materialsRequired, materialsSatisfied, source, testRequired, checklistRequired, formSatisfied, onlineTest, f.supplementary(), List.copyOf(missing));
    }
}
