import React from "react";
import { EffectiveAccessPanel } from "../EffectiveAccessPanel";
import type { AccessProfileDetailResponse } from "@/services/api/settings";

interface AccessProfileEffectiveAccessTabProps { profile: AccessProfileDetailResponse; isEditing: boolean; }

export const AccessProfileEffectiveAccessTab: React.FC<AccessProfileEffectiveAccessTabProps> = ({ profile, isEditing }) => {
  return <div className="w-full space-y-5">
    {isEditing && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">Effective Access shows the currently saved configuration. Save changes to refresh it.</div>}
    <EffectiveAccessPanel accessProfileId={profile.id} />
  </div>;
};
