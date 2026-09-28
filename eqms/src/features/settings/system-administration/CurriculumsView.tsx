import React from "react";
import { useNavigate } from "react-router-dom";
import { ComingSoonView } from "../document-administration/ComingSoonView";
import { curriculums } from "@/components/ui/breadcrumb/breadcrumbs/settings";

/** Placeholder entry point for the future Curriculums module. */
export const CurriculumsView: React.FC = () => {
  const navigate = useNavigate();
  return (
    <ComingSoonView
      title="Curriculums"
      breadcrumbItems={curriculums(navigate)}
      description="Curriculum planning across training courses will be managed from here in a future release."
    />
  );
};
