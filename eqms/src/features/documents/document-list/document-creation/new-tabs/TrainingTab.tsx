import React from "react";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { Input, Textarea } from "@/components/ui/form/ResponsiveForm";
import { cn } from "@/components/ui/utils";

interface TrainingConfig {
    isRequired: boolean;
    trainingPeriodDays: number | null;
    reasonForSkippingTraining: string;
}

interface TrainingTabProps {
    isReadOnly?: boolean;
    data?: Partial<TrainingConfig>;
    onChange?: (config: TrainingConfig) => void;
    validationError?: {
        trainingPeriodDays?: boolean;
        reasonForSkippingTraining?: boolean;
    };
}

export const TrainingTab: React.FC<TrainingTabProps> = ({
    isReadOnly = false,
    data,
    onChange,
    validationError
}) => {
    const [config, setConfig] = React.useState<TrainingConfig>({
        isRequired: data?.isRequired ?? false,
        trainingPeriodDays: data?.trainingPeriodDays ?? null,
        reasonForSkippingTraining: data?.reasonForSkippingTraining ?? ""
    });

    React.useEffect(() => {
        setConfig({
            isRequired: data?.isRequired ?? false,
            trainingPeriodDays: data?.trainingPeriodDays ?? null,
            reasonForSkippingTraining: data?.reasonForSkippingTraining ?? ""
        });
    }, [
        data?.isRequired,
        data?.reasonForSkippingTraining,
        data?.trainingPeriodDays,
    ]);

    const updateConfig = (nextConfig: TrainingConfig) => {
        setConfig(nextConfig);
        onChange?.(nextConfig);
    };

    const handleCheckboxChange = (checked: boolean) => {
        updateConfig({
            ...config,
            isRequired: checked,
            // A revision has exactly one training decision. Clear the inactive
            // branch so the payload and audit trail cannot contain conflicting
            // training-period and skip-reason values.
            trainingPeriodDays: checked ? config.trainingPeriodDays : null,
            reasonForSkippingTraining: checked ? "" : config.reasonForSkippingTraining,
        });
    };

    return (
        <div className="space-y-4 lg:space-y-5">
            <div className="flex items-center justify-between font-semibold text-slate-900">
                <Checkbox
                    id="requires-training"
                    label="Requires Training?"
                    checked={config.isRequired}
                    onChange={handleCheckboxChange}
                    disabled={isReadOnly}
                />
            </div>

            {config.isRequired ? (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs sm:text-sm font-medium text-slate-700">
                                    Training Period (Days) {!isReadOnly && <span className="text-red-500">*</span>}
                                </label>
                                <Input
                                    type="number"
                                    min={1}
                                    value={config.trainingPeriodDays ?? ""}
                                    disabled={isReadOnly}
                                    placeholder="Enter number of days"
                                    onChange={(e) => {
                                        const raw = e.target.value;
                                        const parsed = raw.trim() === "" ? null : parseInt(raw, 10);
                                        updateConfig({
                                            ...config,
                                            trainingPeriodDays: parsed !== null && Number.isFinite(parsed) ? parsed : null,
                                            reasonForSkippingTraining: "",
                                        });
                                    }}
                                />
                            </div>
                            {validationError?.trainingPeriodDays && (config.trainingPeriodDays ?? 0) < 1 && (
                                <p className="text-xs text-red-600 mt-1.5 font-medium">
                                    Please enter a valid training period in days
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    <div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs sm:text-sm font-medium text-slate-700">
                                Reason for skipping training {!isReadOnly && <span className="text-red-500">*</span>}
                            </label>
                            <Textarea
                                value={config.reasonForSkippingTraining}
                                onChange={(e) => updateConfig({
                                    ...config,
                                    trainingPeriodDays: null,
                                    reasonForSkippingTraining: e.target.value,
                                })}
                                rows={3}
                                placeholder="Provide a reason for skipping training..."
                                disabled={isReadOnly}
                                className={cn(
                                    validationError?.reasonForSkippingTraining &&
                                    !config.reasonForSkippingTraining.trim() &&
                                    "border-red-300 focus:ring-red-500 focus:border-red-500 bg-red-50"
                                )}
                            />
                        </div>
                        {validationError?.reasonForSkippingTraining && !config.reasonForSkippingTraining.trim() && (
                            <p className="text-xs text-red-600 mt-1.5 font-medium">
                                Please provide a reason for skipping training
                            </p>
                        )}
                    </div>

                    {!isReadOnly && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
                            <p className="text-xs text-amber-800 leading-relaxed">
                                If training is not required, you must provide a valid reason. This will be recorded in the document history for audit purposes.
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export const validateTrainingTab = (config: TrainingConfig): {
    isValid: boolean;
    errors: { trainingPeriodDays?: boolean; reasonForSkippingTraining?: boolean };
} => {
    const errors: { trainingPeriodDays?: boolean; reasonForSkippingTraining?: boolean } = {};

    if (config.isRequired) {
        if (!Number.isFinite(config.trainingPeriodDays) || (config.trainingPeriodDays as number) < 1) {
            errors.trainingPeriodDays = true;
        }
    } else if (!config.reasonForSkippingTraining.trim()) {
        errors.reasonForSkippingTraining = true;
    }

    return {
        isValid: Object.keys(errors).length === 0,
        errors,
    };
};

export type { TrainingConfig };
