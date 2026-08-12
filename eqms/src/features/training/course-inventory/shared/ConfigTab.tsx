import React, { useState } from "react";
import { TrainingMethod } from "../../types";
import { AssessmentConfigContent } from "./AssessmentConfigContent";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";

import { UploadedFile } from "./workflow.types";

interface TrainingConfigTabProps {
    trainingMethod: TrainingMethod;
    readOnly?: boolean;
    // Read-only mode props (string filenames)
    examTemplateName?: string;
    answerKeyName?: string;
    passingGradeType?: "pass_fail" | "score_10" | "percentage";
    passingScore?: number;
    maxAttempts?: number;
    // Edit mode controlled state (optional — if provided, bypasses internal state)
    examTemplate?: UploadedFile | null;
    setExamTemplate?: (f: UploadedFile | null) => void;
    answerKey?: UploadedFile | null;
    setAnswerKey?: (f: UploadedFile | null) => void;
    setPassingGradeType?: (v: "pass_fail" | "score_10" | "percentage") => void;
    setPassingScore?: (v: number) => void;
    setMaxAttempts?: (v: number) => void;
}

export const ConfigTab: React.FC<TrainingConfigTabProps> = ({
    trainingMethod,
    readOnly = false,
    examTemplateName,
    answerKeyName,
    passingGradeType: externalPassingGradeType,
    passingScore: externalPassingScore,
    maxAttempts: externalMaxAttempts,
    examTemplate: externalExamTemplate,
    setExamTemplate: externalSetExamTemplate,
    answerKey: externalAnswerKey,
    setAnswerKey: externalSetAnswerKey,
    setPassingGradeType: externalSetPassingGradeType,
    setPassingScore: externalSetPassingScore,
    setMaxAttempts: externalSetMaxAttempts,
}) => {
    // Internal state — used only when parent doesn't provide controlled props
    const [internalExamTemplate, setInternalExamTemplate] = useState<UploadedFile | null>(null);
    const [internalAnswerKey, setInternalAnswerKey] = useState<UploadedFile | null>(null);
    const [internalPassingGradeType, setInternalPassingGradeType] = useState<"pass_fail" | "score_10" | "percentage">("score_10");
    const [internalPassingScore, setInternalPassingScore] = useState(7);
    const [internalMaxAttempts, setInternalMaxAttempts] = useState(3);

    const isControlled = !!externalSetExamTemplate;

    const effectiveExamTemplate = isControlled ? externalExamTemplate ?? null : internalExamTemplate;
    const effectiveSetExamTemplate = isControlled ? externalSetExamTemplate! : setInternalExamTemplate;
    const effectiveAnswerKey = isControlled ? externalAnswerKey ?? null : internalAnswerKey;
    const effectiveSetAnswerKey = isControlled ? externalSetAnswerKey! : setInternalAnswerKey;
    const effectivePassingGradeType = readOnly
        ? (externalPassingGradeType || "score_10")
        : isControlled ? (externalPassingGradeType || "score_10") : internalPassingGradeType;
    const effectiveSetPassingGradeType = isControlled ? externalSetPassingGradeType! : setInternalPassingGradeType;
    const effectivePassingScore = readOnly
        ? (externalPassingScore ?? 7)
        : isControlled ? (externalPassingScore ?? 7) : internalPassingScore;
    const effectiveSetPassingScore = isControlled ? externalSetPassingScore! : setInternalPassingScore;
    const effectiveMaxAttempts = readOnly
        ? (externalMaxAttempts ?? 3)
        : isControlled ? (externalMaxAttempts ?? 3) : internalMaxAttempts;
    const effectiveSetMaxAttempts = isControlled ? externalSetMaxAttempts! : setInternalMaxAttempts;

    return (
        <div className="p-4 md:p-5 space-y-6">

            {/* Read & Understood: simple notice */}
            {trainingMethod === "Read & Understood" && (
                <WarningBanner
                    variant="info"
                    title="Read & Understood"
                    description="Employee will read the linked document, then confirm they have understood it by e-signature. No quiz required."
                />
            )}

            {/* Hands-on/OJT: trainer sign-off notice */}
            {trainingMethod === "Hands-on/OJT" && (
                <WarningBanner
                    variant="warning"
                    title="Hands-on / OJT"
                    description={
                        <span>
                            Trainer must sign off to confirm the employee has demonstrated practical competency. The employee <strong>cannot self-complete</strong> this course.
                        </span>
                    }
                />
            )}

            {/* Quiz (Paper-based/Manual): assessment config */}
            {trainingMethod === "Quiz (Paper-based/Manual)" && (
                <AssessmentConfigContent
                    readOnly={readOnly}
                    examTemplate={readOnly ? undefined : effectiveExamTemplate}
                    setExamTemplate={readOnly ? undefined : effectiveSetExamTemplate}
                    answerKey={readOnly ? undefined : effectiveAnswerKey}
                    setAnswerKey={readOnly ? undefined : effectiveSetAnswerKey}
                    examTemplateName={readOnly ? examTemplateName : undefined}
                    answerKeyName={readOnly ? answerKeyName : undefined}
                    passingGradeType={effectivePassingGradeType}
                    setPassingGradeType={readOnly ? undefined : effectiveSetPassingGradeType}
                    passingScore={effectivePassingScore}
                    setPassingScore={readOnly ? undefined : effectiveSetPassingScore}
                    maxAttempts={effectiveMaxAttempts}
                    setMaxAttempts={readOnly ? undefined : effectiveSetMaxAttempts}
                />
            )}
        </div>
    );
};
