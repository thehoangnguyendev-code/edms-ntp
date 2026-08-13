import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { Mail, Info, Variable, Send, History, Rocket } from "lucide-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FormSection } from "@/components/ui/form";
import { Loading } from "@/components/ui/loading";
import { useNavigateWithLoading } from "@/hooks/useNavigateWithLoading";
import { navigateBack } from "@/app/navigation/backNavigation";
import { EMAIL_TEMPLATE_TYPES, EMAIL_TEMPLATES_ROUTES, EMAIL_VARIABLES, getEmailTemplateTypeConfig } from "../constants";
import { emailTemplates } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { EmailLivePreview } from "../components/EmailLivePreview";
import type { EmailTemplate, EmailTemplatePreviewResponse, EmailTemplateVersion } from "../types";
import { emailTemplateApi } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/toast";
import { buildSampleVariables } from "../utils/emailTemplateVariables";
import { useTranslation } from "@/i18n";

export const EmailTemplatePreviewView: React.FC = () => {
  const { navigateTo, isNavigating } = useNavigateWithLoading();
  const location = useLocation();
  const { id } = useParams<{ id?: string }>();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const initialTemplate = location.state?.template as EmailTemplate | null | undefined;

  const [template, setTemplate] = useState<EmailTemplatePreviewResponse | null>(null);
  const [versions, setVersions] = useState<EmailTemplateVersion[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(id && !initialTemplate));
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [restoringVersionId, setRestoringVersionId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadTemplate = async () => {
      if (!id) {
        return;
      }

      setIsLoading(true);
      try {
        const sourceTemplate = initialTemplate ?? await emailTemplateApi.getEmailTemplate(id);
        const data = await emailTemplateApi.previewEmailTemplate(id, {
          variables: buildSampleVariables(sourceTemplate.variables || []),
        });
        if (!cancelled) {
          setTemplate(data);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load email template preview:", error);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    const loadVersions = async () => {
      if (!id) {
        return;
      }

      setIsLoadingHistory(true);
      try {
        const data = await emailTemplateApi.getEmailTemplateVersions(id);
        if (!cancelled) {
          setVersions(data);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load email template versions:", error);
          setVersions([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingHistory(false);
        }
      }
    };

    loadTemplate();
    loadVersions();

    return () => {
      cancelled = true;
    };
  }, [id, initialTemplate]);

  const previewTemplate = useMemo(() => template, [template]);
  const latestVersionLabel = previewTemplate?.latestVersionNumber ? `v${previewTemplate.latestVersionNumber}` : "v1";

  const handleBack = () => {
    navigateBack(navigateTo, location.state, EMAIL_TEMPLATES_ROUTES.LIST);
  };

  const refreshTemplateAndHistory = async (variables: string[] = template?.variables || []) => {
    if (!id) {
      return;
    }
    const [freshTemplate, freshVersions] = await Promise.all([
      emailTemplateApi.previewEmailTemplate(id, {
        variables: buildSampleVariables(variables),
      }),
      emailTemplateApi.getEmailTemplateVersions(id),
    ]);
    setTemplate(freshTemplate);
    setVersions(freshVersions);
  };

  const handlePublish = async () => {
    if (!id || !previewTemplate) {
      return;
    }
    setIsPublishing(true);
    try {
      const updated = await emailTemplateApi.publishEmailTemplate(id, {
        changeSummary: "Published from email template preview",
      });
      setTemplate(updated);
      await refreshTemplateAndHistory(previewTemplate.variables || []);
      showToast({
        type: "success",
        title: t("emailTemplatePreview.publishedTitle"),
        message: t("emailTemplatePreview.publishedMessage", { name: updated.name }),
      });
    } catch (error) {
      showToast({
        type: "error",
        title: t("emailTemplatePreview.publishFailedTitle"),
        message: error instanceof Error ? error.message : t("emailTemplatePreview.publishFailedMessage"),
      });
    } finally {
      setIsPublishing(false);
    }
  };

  const handleRestoreVersion = async (version: EmailTemplateVersion) => {
    if (!id) {
      return;
    }
    setRestoringVersionId(version.id);
    try {
      const updated = await emailTemplateApi.restoreEmailTemplateVersion(id, version.id, {
        changeSummary: `Restored version ${version.versionNumber}`,
      });
      setTemplate(updated);
      await refreshTemplateAndHistory(version.variables || []);
      showToast({
        type: "success",
        title: t("emailTemplatePreview.restoredTitle"),
        message: t("emailTemplatePreview.restoredMessage", { name: updated.name, version: version.versionNumber }),
      });
    } catch (error) {
      showToast({
        type: "error",
        title: t("emailTemplatePreview.restoreFailedTitle"),
        message: error instanceof Error ? error.message : t("emailTemplatePreview.restoreFailedMessage"),
      });
    } finally {
      setRestoringVersionId(null);
    }
  };

  const handleTestSend = async () => {
    if (!previewTemplate) {
      return;
    }

    const recipient = user?.email?.trim();
    if (!recipient) {
      showToast({
        type: "error",
        title: t("emailTemplatePreview.missingEmailTitle"),
        message: t("emailTemplatePreview.missingEmailMessage"),
      });
      return;
    }

    setIsSending(true);
    try {
      await emailTemplateApi.testSendEmailTemplate(previewTemplate.id, {
        to: recipient,
        variables: buildSampleVariables(previewTemplate.variables || []),
      });
      showToast({
        type: "success",
        title: t("emailTemplatePreview.testSentTitle"),
        message: t("emailTemplatePreview.testSentMessage", { recipient }),
      });
    } catch (error) {
      showToast({
        type: "error",
        title: t("emailTemplatePreview.testSendFailedTitle"),
        message: error instanceof Error ? error.message : t("emailTemplatePreview.testSendFailedMessage"),
      });
    } finally {
      setIsSending(false);
    }
  };

  if (!isLoading && !previewTemplate) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 h-[60vh]">
        <div className="h-20 w-20 rounded-full bg-slate-100 flex items-center justify-center mb-4">
          <Mail className="h-10 w-10 text-slate-300" />
        </div>
        <h3 className="text-lg font-medium text-slate-900">No template selected</h3>
        <p className="text-slate-500 mt-1">Please select a template from the list to preview.</p>
        <Button onClick={handleBack} className="mt-6">Go Back</Button>
      </div>
    );
  }

  if (isLoading || !previewTemplate) {
    return (
      <div className="flex items-center justify-center flex-1 h-[60vh]">
        <Loading text="Loading template..." />
      </div>
    );
  }

  const templateType = getEmailTemplateTypeConfig(previewTemplate.type);

  return (
    <div className="space-y-5 w-full flex-1 flex flex-col pb-8">
      <PageHeader
        title={`Preview: ${previewTemplate.name}`}
        breadcrumbItems={[...emailTemplates(), { label: "Preview" }]}
        actions={
          <>
            {previewTemplate.status !== "Active" && (
              <Button
                size="sm"
                variant="outline-emerald"
                className="whitespace-nowrap"
                onClick={handlePublish}
                disabled={isPublishing}
              >
                <Rocket className="h-4 w-4" />
                {isPublishing ? "Publishing..." : "Publish"}
              </Button>
            )}
                        <Button
              size="sm"
              variant="outline-emerald"
              className="whitespace-nowrap"
              onClick={handleBack}
            >
              Back
            </Button>
            <Button
              size="sm"
              variant="outline-emerald"
              className="whitespace-nowrap"
              onClick={handleTestSend}
              disabled={isSending}
            >
              {isSending ? "Sending..." : "Send Test Email"}
            </Button>

          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-4 space-y-5">
          <FormSection title="Template Info" icon={<Info className="h-4 w-4" />}>
            <div className="space-y-3 lg:space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center gap-1.5 lg:gap-2 pb-3 lg:pb-4 border-b border-slate-200">
                <label className="text-xs sm:text-sm font-medium text-slate-700 w-full lg:w-40 flex-shrink-0">Name</label>
                <p className="text-xs lg:text-sm text-slate-900 font-medium flex-1">{previewTemplate.name}</p>
              </div>

              <div className="flex flex-col lg:flex-row lg:items-center gap-1.5 lg:gap-2 pb-3 lg:pb-4 border-b border-slate-200">
                <label className="text-xs sm:text-sm font-medium text-slate-700 w-full lg:w-40 flex-shrink-0">Status</label>
                <div className="flex-1">
                  <Badge
                    color={previewTemplate.status === "Active" ? "emerald" : previewTemplate.status === "Inactive" ? "slate" : "amber"}
                    size="sm"
                    pill
                  >
                    {previewTemplate.status}
                  </Badge>
                </div>
              </div>

              <div className="flex flex-col lg:flex-row lg:items-center gap-1.5 lg:gap-2 pb-3 lg:pb-4 border-b border-slate-200">
                <label className="text-xs sm:text-sm font-medium text-slate-700 w-full lg:w-40 flex-shrink-0">Type</label>
                <p className="text-xs lg:text-sm text-slate-900 flex-1">{templateType.label}</p>
              </div>

              <div className="flex flex-col lg:flex-row lg:items-center gap-1.5 lg:gap-2 pb-3 lg:pb-4 border-b border-slate-200">
                <label className="text-xs sm:text-sm font-medium text-slate-700 w-full lg:w-40 flex-shrink-0">Author</label>
                <p className="text-xs lg:text-sm text-slate-900 flex-1 truncate" title={previewTemplate.createdBy || ""}>
                  {previewTemplate.createdBy || "System"}
                </p>
              </div>

              <div className="flex flex-col lg:flex-row lg:items-center gap-1.5 lg:gap-2 pb-3 lg:pb-4 border-b border-slate-200">
                <label className="text-xs sm:text-sm font-medium text-slate-700 w-full lg:w-40 flex-shrink-0">Usage</label>
                <p className="text-xs lg:text-sm text-slate-900 flex-1">{previewTemplate.usageCount ?? 0} times</p>
              </div>

              <div className="flex flex-col lg:flex-row lg:items-center gap-1.5 lg:gap-2 pb-3 lg:pb-4 border-b border-slate-200">
                <label className="text-xs sm:text-sm font-medium text-slate-700 w-full lg:w-40 flex-shrink-0">Version</label>
                <p className="text-xs lg:text-sm text-slate-900 flex-1">{latestVersionLabel}</p>
              </div>

              <div className="flex flex-col lg:flex-row lg:items-center gap-1.5 lg:gap-2 pb-3 lg:pb-4 border-b border-slate-200">
                <label className="text-xs sm:text-sm font-medium text-slate-700 w-full lg:w-40 flex-shrink-0">Last Used</label>
                <p className="text-xs lg:text-sm text-slate-900 flex-1">{previewTemplate.lastUsed || "Never"}</p>
              </div>

              <div className="flex flex-col lg:flex-row lg:items-start gap-1.5 lg:gap-2">
                <label className="text-xs sm:text-sm font-medium text-slate-700 w-full lg:w-40 flex-shrink-0">Description</label>
                <p className="text-xs lg:text-sm text-slate-900 flex-1 leading-relaxed">
                  {previewTemplate.description || "—"}
                </p>
              </div>
            </div>
          </FormSection>

          {previewTemplate.variables.length > 0 && (
            <FormSection title="Dynamic Variables" icon={<Variable className="h-4 w-4" />}>
              <p className="text-xs text-slate-500 mb-3">Preview values are sample data from the variable catalog</p>
              <div className="flex flex-wrap gap-2">
                {previewTemplate.variables.map((variableKey) => {
                  const variable = EMAIL_VARIABLES.find((v) => v.key === variableKey);
                  return variable ? (
                    <Badge key={variableKey} color="blue" size="sm" className="cursor-help">
                      {variableKey}
                    </Badge>
                  ) : (
                    <Badge key={variableKey} color="slate" size="sm">
                      {variableKey}
                    </Badge>
                  );
                })}
              </div>
            </FormSection>
          )}

          <FormSection title="Version History" icon={<History className="h-4 w-4" />}>
            {isLoadingHistory ? (
              <Loading text="Loading versions..." />
            ) : versions.length === 0 ? (
              <p className="text-sm text-slate-500">No version history available yet.</p>
            ) : (
              <div className="space-y-3">
                {versions.map((version) => (
                  <div key={version.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Version {version.versionNumber}</p>
                        <p className="text-xs text-slate-500">{version.changeSummary || version.description || "Snapshot saved"}</p>
                      </div>
                      <Badge color={version.status === "Active" ? "emerald" : version.status === "Inactive" ? "slate" : "amber"} size="sm" pill>
                        {version.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-slate-500 space-y-1">
                      <p>Created by: {version.createdBy || "System"}</p>
                      <p>Created at: {version.createdAt ? new Date(version.createdAt).toLocaleString() : "N/A"}</p>
                      {version.publishedAt && <p>Published at: {new Date(version.publishedAt).toLocaleString()}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      {version.versionNumber !== previewTemplate.latestVersionNumber && (
                        <Button
                          size="sm"
                          variant="outline-emerald"
                          onClick={() => handleRestoreVersion(version)}
                          disabled={restoringVersionId === version.id}
                        >
                          {restoringVersionId === version.id ? "Restoring..." : "Restore"}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </FormSection>
        </div>

        <div className="lg:col-span-8 flex flex-col">
          <FormSection title="Live Client Preview" icon={<Mail className="h-4 w-4" />}>
            <EmailLivePreview
              subject={previewTemplate.subject}
              content={previewTemplate.content}
              variables={previewTemplate.variables}
              copyright={previewTemplate.copyright}
              contactEmail={previewTemplate.contactEmail}
              logoUrl={previewTemplate.logoUrl}
              renderedSubject={previewTemplate.subject}
              renderedHtml={previewTemplate.content}
            />
          </FormSection>
        </div>
      </div>

      {isNavigating && <Loading fullPage text="Loading..." />}
    </div>
  );
};
