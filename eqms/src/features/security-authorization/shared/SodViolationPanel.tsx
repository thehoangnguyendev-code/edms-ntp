import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge/Badge";
import type { SodCombinationProfileRef, SodProfileCombinationViolationResponse } from "@/services/api/settings";
import { IconAlertTriangle } from "@tabler/icons-react";

/** One impact-scoped remediation option for a single contributing profile -- "Mức 2/3" from the
 *  three-tier design: removing a whole profile from just this user (Mức 1) needs no server data
 *  and is rendered as the constant top-level guidance line below, not per-option here. */
const RemediationOptions: React.FC<{ profile: SodCombinationProfileRef }> = ({ profile }) => {
  if (profile.permissionSets.length === 0) return null;
  return (
    <ul className="mt-1.5 space-y-1 border-l-2 border-current/20 pl-3">
      {profile.permissionSets.map((set) => (
        <li key={set.permissionSetId} className="text-2xs leading-relaxed">
          <Link
            to={`/security/permission-sets/${set.permissionSetId}/edit`}
            className="font-medium underline decoration-dotted underline-offset-2 hover:opacity-80"
          >
            {set.permissionSetName}
          </Link>
          {" — remove from "}
          <Link
            to={`/security/access-profiles/${profile.accessProfileId}`}
            className="underline decoration-dotted underline-offset-2 hover:opacity-80"
          >
            {profile.accessProfileName}
          </Link>
          {profile.usersHoldingThisProfile > 1 && (
            <span className="opacity-80"> (affects {profile.usersHoldingThisProfile} user{profile.usersHoldingThisProfile === 1 ? "" : "s"} holding this profile)</span>
          )}
          {set.profilesUsingThisSet > 1 && (
            <span className="opacity-80">
              {" "}— or edit the Permission Set itself, affecting {set.usersAffectedIfEditedAtSetLevel} user{set.usersAffectedIfEditedAtSetLevel === 1 ? "" : "s"} across all {set.profilesUsingThisSet} profiles that use it
            </span>
          )}
        </li>
      ))}
    </ul>
  );
};

/** Shows SoD violations detected across a proposed set of Access Profiles, one card per constraint,
 *  with impact-scoped remediation options: (1) remove one of the conflicting profiles from just
 *  this user -- always safe, shown as the default guidance; (2)/(3) edit the shared Permission Set
 *  or Access Profile instead -- shown collapsed, since those affect every OTHER user holding them
 *  too, and the exact affected count is named before suggesting it. */
export const SodViolationPanel: React.FC<{ violations: SodProfileCombinationViolationResponse[] }> = ({
  violations,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  if (violations.length === 0) return null;
  const hasBlockingViolation = violations.some((v) => v.severity === "BLOCK");

  return (
    <div className="space-y-2">
      {violations.map((v) => {
        const hasRemediationOptions =
          [...v.contributingProfilesA, ...v.contributingProfilesB].some((p) => p.permissionSets.length > 0);
        const isExpanded = expandedId === v.constraintId;
        return (
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

                <p className="mt-1.5 text-2xs font-medium">
                  Safest fix: remove one of the conflicting profiles from this user.
                </p>

                {hasRemediationOptions && (
                  <>
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : v.constraintId)}
                      className="mt-1 inline-flex items-center gap-1 text-2xs font-medium underline decoration-dotted underline-offset-2 hover:opacity-80"
                    >
                      {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      {isExpanded ? "Hide other options" : "Other options (affects other users)"}
                    </button>
                    {isExpanded && (
                      <div className="mt-1.5 space-y-2">
                        {[...v.contributingProfilesA, ...v.contributingProfilesB]
                          .filter((p) => p.permissionSets.length > 0)
                          .map((profile) => (
                            <RemediationOptions key={profile.accessProfileId} profile={profile} />
                          ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}
      {hasBlockingViolation && (
        <p className="text-2xs text-red-600 font-medium">
          Resolve the blocked conflict(s) above before saving.
        </p>
      )}
    </div>
  );
};
