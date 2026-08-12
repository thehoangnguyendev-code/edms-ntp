import React from "react";
import { Navigate } from "react-router-dom";
import { ROUTES } from "@/app/routes.constants";

/** @deprecated Governance rules now live in Security & Authorization. */
export const DocumentAdministrationView: React.FC = () => (
  <Navigate to={ROUTES.SECURITY.SOD} replace />
);
