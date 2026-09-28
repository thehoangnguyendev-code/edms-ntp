import React from "react";
import { useNavigate } from "react-router-dom";
import { ComingSoonView } from "../document-administration/ComingSoonView";
import { requirementTemplates } from "@/components/ui/breadcrumb/breadcrumbs/settings";

/** Placeholder entry point for the future Requirement Templates module. */
export const RequirementTemplatesView: React.FC = () => {
  const navigate = useNavigate();
  return (
    <ComingSoonView
      title="Requirement Templates"
      breadcrumbItems={requirementTemplates(navigate)}
      description="Reusable training requirement templates will be managed from here in a future release."
    />
  );
};
