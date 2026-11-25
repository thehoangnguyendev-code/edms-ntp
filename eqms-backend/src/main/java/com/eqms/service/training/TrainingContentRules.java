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
 *       An external training, a visitor and an activity the organizer exempted (with a reason) need none. A supplementary training is held to the same rules: it starts with a copy of the content of the activity it supplements.</li>
 *   <li>Assessment form: a session assessed by a Test needs the test (APD.0009, the exam file made from an approved assessment of the library); a session assessed by a Checklist needs the checklist form. Observation and
 *       self-reading confirmation need no file. The same exemptions apply.</li>
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
        // A supplementary training starts with the content and the assessment of the activity it supplements (copied when it is arranged) and is held to the same rules: it keeps them, changes them or exempts them with a reason.
        boolean freeByRule = external || visitor;

        boolean materialsRequired = !freeByRule && !f.materialsExempt();
        boolean materialsSatisfied = f.documentLinked() || f.contentFiles() > 0;
        String source = f.documentLinked() ? "DOCUMENT" : f.contentFiles() > 0 ? "FILES" : "NONE";

        boolean assessmentNeeded = !freeByRule && !f.assessmentExempt();
        List<String> assessments = f.sessionAssessments() == null ? List.of() : f.sessionAssessments();
        boolean testRequired = assessmentNeeded && assessments.contains("TEST");
        boolean checklistRequired = assessmentNeeded && assessments.contains("CHECKLIST");
        boolean formSatisfied = f.assessmentForms() > 0;
        // A test written in the system (older activities) is shown, but it no longer takes the place of the test of the library: only an approved assessment is put into a training (owner decision 2026-11-23).
        boolean onlineTest = f.onlineTestQuestions() > 0;

        List<String> missing = new ArrayList<>();
        if (materialsRequired && !materialsSatisfied) missing.add(MATERIALS_REQUIRED);
        if (testRequired && !formSatisfied) missing.add(TEST_REQUIRED);
        else if (checklistRequired && !formSatisfied) missing.add(CHECKLIST_REQUIRED);
        return new Result(materialsRequired, materialsSatisfied, source, testRequired, checklistRequired, formSatisfied, onlineTest, f.supplementary(), List.copyOf(missing));
    }
}
