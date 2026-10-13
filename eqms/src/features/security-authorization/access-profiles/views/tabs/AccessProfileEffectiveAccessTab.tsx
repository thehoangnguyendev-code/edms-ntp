import React from "react";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { EffectiveAccessPanel } from "../EffectiveAccessPanel";
import type { AccessProfileDetailResponse } from "@/services/api/settings";

interface AccessProfileEffectiveAccessTabProps { profile: AccessProfileDetailResponse; isEditing: boolean; }

export const AccessProfileEffectiveAccessTab: React.FC<AccessProfileEffectiveAccessTabProps> = ({ profile, isEditing }) => {
  return <div className="w-full space-y-5">
    {isEditing && <WarningBanner variant="warning">Effective Access shows the currently saved configuration. Save changes to refresh it.</WarningBanner>}
    <EffectiveAccessPanel accessProfileId={profile.id} />
  </div>;
};
