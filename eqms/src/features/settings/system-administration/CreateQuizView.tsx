import React from "react";
import { useNavigate } from "react-router-dom";
import { ComingSoonView } from "../document-administration/ComingSoonView";
import { createQuiz } from "@/components/ui/breadcrumb/breadcrumbs/settings";

/** Placeholder entry point for the future Create a Quiz module. */
export const CreateQuizView: React.FC = () => {
  const navigate = useNavigate();
  return (
    <ComingSoonView
      title="Create a Quiz"
      breadcrumbItems={createQuiz(navigate)}
      description="Quiz authoring for training courses will be managed from here in a future release."
    />
  );
};
