import React from "react";
import { ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge/Badge";
import type { SodProfileCombinationViolationResponse } from "@/services/api/settings";
import { IconAlertTriangle } from "@tabler/icons-react";

/** Shows SoD violations detected across a proposed set of Access Profiles, one card per constraint. */
export const SodViolationPanel: React.FC<{ violations: SodProfileCombinationViolationResponse[] }> = ({
  violations,
}) => {
  if (violations.length === 0) return null;
  const hasBlockingViolation = violations.some((v) => v.severity === "BLOCK");

  return (
    <div className="space-y-2">
      {violations.map((v) => (
        <div
          key={v.constraintId}
          className={`rounded-lg border px-3.5 py-2.5 text-xs ${
            v.severity === "BLOCK"
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          <div className="flex items-start gap-2">
            <IconAlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{v.constraintName}</span>
                <Badge color={v.severity === "BLOCK" ? "red" : "amber"} size="sm" pill>
                  {v.severity === "BLOCK" ? "Blocked" : "Warning"}
                </Badge>
              </div>
              <p className="mt-1 leading-relaxed">
                <span className="font-medium">{v.permissionNameA}</span>
                {" "}(via {v.contributingProfilesA.map((p) => p.accessProfileName).join(", ")})
                {" "}conflicts with{" "}
                <span className="font-medium">{v.permissionNameB}</span>
                {" "}(via {v.contributingProfilesB.map((p) => p.accessProfileName).join(", ")})
              </p>
              {v.regulationRef && <p className="mt-1 text-2xs opacity-80">Ref: {v.regulationRef}</p>}
            </div>
          </div>
        </div>
      ))}
      {hasBlockingViolation && (
        <p className="text-2xs text-red-600 font-medium">
          Resolve the blocked conflict(s) above — remove one of the conflicting profiles — before saving.
        </p>
      )}
    </div>
  );
};
