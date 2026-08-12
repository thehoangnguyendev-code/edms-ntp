import React from "react";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { Input, Textarea } from "@/components/ui/form/ResponsiveForm";

interface TrainingInformationData {
  isRequired?: boolean;
  trainingPeriodDays?: number | null;
  reasonForSkippingTraining?: string | null;
}

interface TrainingInformationTabProps {
  data?: TrainingInformationData;
  isReadOnly?: boolean;
  onChange?: (data: TrainingInformationData) => void;
}

export const TrainingInformationTab: React.FC<TrainingInformationTabProps> = ({
  data,
  isReadOnly = true,
  onChange,
}) => {
  const isRequired = Boolean(data?.isRequired);
  const trainingPeriodDays = data?.trainingPeriodDays ?? null;
  const reasonForSkippingTraining = data?.reasonForSkippingTraining ?? "";

  const emit = (next: TrainingInformationData) => onChange?.(next);

  return (
    <div className="space-y-4 lg:space-y-5">
      <div className="flex items-center justify-between font-semibold text-slate-900">
        <Checkbox
          id="requires-training-detail"
          label="Requires Training?"
          checked={isRequired}
          disabled={isReadOnly}
          onChange={(checked) =>
            emit({
              isRequired: checked,
              trainingPeriodDays: checked ? trainingPeriodDays : null,
              reasonForSkippingTraining: checked ? "" : reasonForSkippingTraining,
            })
          }
        />
      </div>

      {isRequired ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs sm:text-sm font-medium text-slate-700">
                Training Period (Days)
              </label>
              <Input
                type="number"
                min={1}
                value={trainingPeriodDays ?? ""}
                disabled={isReadOnly}
                onChange={(e) =>
                  emit({
                    isRequired,
                    trainingPeriodDays: e.target.value ? Number(e.target.value) : null,
                    reasonForSkippingTraining: null,
                  })
                }
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs sm:text-sm font-medium text-slate-700">
              Reason for skipping training
            </label>
            <Textarea
              value={reasonForSkippingTraining}
              disabled={isReadOnly}
              rows={3}
              placeholder="—"
              onChange={(e) =>
                emit({
                  isRequired,
                  trainingPeriodDays: null,
                  reasonForSkippingTraining: e.target.value,
                })
              }
            />
          </div>
        </div>
      )}
    </div>
  );
};
