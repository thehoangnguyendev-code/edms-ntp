import React from "react";
import { useNavigate } from "react-router-dom";
import { ComingSoonView } from "../document-administration/ComingSoonView";
import { trainingProperties } from "@/components/ui/breadcrumb/breadcrumbs/settings";

/** Placeholder entry point for the future Training Properties module. */
export const TrainingPropertiesView: React.FC = () => {
  const navigate = useNavigate();
  return (
    <ComingSoonView
      title="Training Properties"
      breadcrumbItems={trainingProperties(navigate)}
      description="Training program-wide configuration will be managed from here in a future release."
    />
  );
};
