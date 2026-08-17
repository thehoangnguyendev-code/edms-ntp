import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { Settings, Variable, Mail, Eye } from "lucide-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button";
import { Input, Textarea, FormSection } from "@/components/ui/form";
import { Select } from "@/components/ui/select";
import { LexicalEditor } from "../components/LexicalEditor";
import { EmailLivePreview } from "../components/EmailLivePreview";
import { LogoUploader } from "../components/LogoUploader";
import { Badge } from "@/components/ui/badge";
import { AlertModal } from "@/components/ui/modal";
import { NavigationGuardModal } from "@/components/ui/modal/NavigationGuardModal";
import { ESignatureModal } from "@/components/ui/esign-modal";
import { Loading } from "@/components/ui/loading";
import { useNavigateWithLoading } from "@/hooks/useNavigateWithLoading";
import { navigateBack } from "@/app/navigation/backNavigation";
import { emailTemplateCreate } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { EMAIL_TEMPLATE_TYPES, EMAIL_VARIABLES } from "../constants";
import { useEmailTemplatesList } from "../hooks/useEmailTemplatesList";
import type { EmailTemplatePreviewResponse, EmailTemplateType, EmailTemplateStatus } from "../types";
import { buildSampleVariables, extractEmailTemplateVariables } from "../utils/emailTemplateVariables";
import { emailTemplateApi } from "@/services/api";
import { BRAND_PRIMARY_HEX } from "@/styles/tokens";
import { ColorPickerInput } from "@/components/ui/color-picker/ColorPickerInput";


// Field wrapper matching DocumentFilters label style
const Field: React.FC<{
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
  hint?: string;
}> = ({ label, required, error, children, hint }) => (
  <div className="w-full">
    <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">
      {label}{required && <span className="text-red-500 ml-1">*</span>}
    </label>
    {children}
    {hint && !error && <p className="text-2xs sm:text-xs font-normal text-slate-400 flex items-center gap-1">{hint}</p>}
    {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
  </div>
);

type EmailTemplateFormData = {
  name: string;
  subject: string;
  type: EmailTemplateType;
  description: string;
  content: string;
  variables: string[];
  logoUrl: string;
  logoFileName: string;
  copyright: string;
  contactEmail: string;
  primaryColor: string;
  fontFamily: string;
  status: EmailTemplateStatus;
};

export const EmailTemplateCreateView: React.FC = () => {
  const { navigateTo, isNavigating } = useNavigateWithLoading();
  const location = useLocation();
  const { createEmailTemplate } = useEmailTemplatesList({ autoFetch: false });

  const [formData, setFormData] = useState<EmailTemplateFormData>({
    name: "",
    subject: "",
    type: "password-reset",
    description: "",
    content: "",
    variables: [],
    logoUrl: "",
    logoFileName: "",
    copyright: "",
    contactEmail: "",
    primaryColor: BRAND_PRIMARY_HEX,
    fontFamily: "Arial, Helvetica, sans-serif",
    status: "Draft"
  });

  const templateTypeOptions = Object.entries(EMAIL_TEMPLATE_TYPES) as [
    EmailTemplateType,
    { label: string; description: string; icon: string }
  ][];

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [showESign, setShowESign] = useState(false);
  const [pendingInsert, setPendingInsert] = useState<string | undefined>(undefined);
  const [previewData, setPreviewData] = useState<EmailTemplatePreviewResponse | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const sampleVariables = useMemo(() => buildSampleVariables(formData.variables), [formData.variables]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value };
      if (field === "content" || field === "subject") {
        next.variables = extractEmailTemplateVariables(next.subject, next.content);
      }
      if (field === "logoUrl" && typeof value === "string" && !value.startsWith("data:")) {
        next.logoFileName = "";
      }
      return next;
    });
    setErrors(prev => ({ ...prev, [field]: "" }));
    setUnsavedChanges(true);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = "Template name is required";
    if (!formData.subject.trim()) newErrors.subject = "Email subject is required";
    if (!formData.content.trim()) newErrors.content = "Email content is required";
    if (!formData.type) newErrors.type = "Template type is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    setShowSaveConfirm(true);
  };

  const handleESignConfirm = async (data: { reason: string; signatureToken?: string }) => {
    setShowESign(false);
    setIsSubmitting(true);
    try {
      await createEmailTemplate({ ...formData, reason: data.reason, signatureToken: data.signatureToken });
      setUnsavedChanges(false);
      navigateTo("/settings/email-templates");
    } catch (error) {
      console.error("Failed to create template:", error);
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    if (unsavedChanges) {
      setShowCancelModal(true);
      return;
    }
    navigateBack(navigateTo, location.state, "/settings/email-templates");
  };

  const handleCancelConfirm = () => {
    setShowCancelModal(false);
    navigateBack(navigateTo, location.state, "/settings/email-templates");
  };

  useEffect(() => {
    let cancelled = false;

    const loadPreview = async () => {
      if (!isPreviewMode) {
        setPreviewData(null);
        return;
      }

      setIsPreviewLoading(true);
      try {
        const data = await emailTemplateApi.previewDraftEmailTemplate({
          ...formData,
          sampleVariables,
        });
        if (!cancelled) {
          setPreviewData(data);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to render template preview:", error);
          setPreviewData(null);
        }
      } finally {
        if (!cancelled) {
          setIsPreviewLoading(false);
        }
      }
    };

    const timer = window.setTimeout(() => {
      void loadPreview();
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [formData, isPreviewMode, sampleVariables]);

  return (
    <div className="space-y-5 w-full flex-1 flex flex-col">
      {/* Header */}
      <PageHeader
        title="Create Email Template"
        breadcrumbItems={emailTemplateCreate()}
        actions={
          <>
            <Button size="sm" variant="outline-emerald" className="whitespace-nowrap" onClick={handleBack}>
              Back
            </Button>
            <Button size="sm" variant="outline-emerald" className="whitespace-nowrap" onClick={() => setIsPreviewMode(p => !p)}>
              {isPreviewMode ? "Edit" : "Preview"}
            </Button>
            <Button size="sm" variant="outline-emerald" className="whitespace-nowrap" onClick={handleSave} disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Template"}
            </Button>
          </>
        }
      />

      {/* Card 1: Template Settings - Full Width */}
      <FormSection title="Template Settings" icon={<Settings className="h-4 w-4" />}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Logo */}
            <Field label="Logo">
              <LogoUploader
                value={formData.logoUrl}
                onChange={(url, fileName) => {
                  handleInputChange("logoUrl", url);
                  if (fileName !== undefined) {
                    handleInputChange("logoFileName", fileName);
                  } else if (!url.startsWith("data:")) {
                    handleInputChange("logoFileName", "");
                  }
                }}
              />
            </Field>

          {/* Right: Status, Copyright, Contact Email */}
          <div className="space-y-4">
            <Field label="Status">
              <Select
                value={formData.status}
                onChange={(value) => handleInputChange("status", value)}
                options={[
                  { label: "Draft", value: "Draft" },
                  { label: "Active", value: "Active" },
                  { label: "Inactive", value: "Inactive" }
                ]}
              />
            </Field>
            <Field label="Copyright" hint="e.g. © 2007 - 2026 Company Name">
              <Input
                value={formData.copyright}
                onChange={(e) => handleInputChange("copyright", e.target.value)}
                placeholder="© 2007 - 2026 Your Company Name"
              />
            </Field>
            <Field label="Contact Email" hint="Support email shown in footer">
              <Input
                value={formData.contactEmail}
                onChange={(e) => handleInputChange("contactEmail", e.target.value)}
                placeholder="support@example.com"
                type="email"
              />
            </Field>
            <Field label="Brand Color" hint="Header background and link color">
              <ColorPickerInput value={formData.primaryColor} onChange={(value) => handleInputChange("primaryColor", value)} />
            </Field>
            <Field label="Email Font" hint="Uses email-safe fonts for consistent rendering across clients">
              <Select value={formData.fontFamily} onChange={(value) => handleInputChange("fontFamily", value)} options={[
                { label: "Arial", value: "Arial, Helvetica, sans-serif" }, { label: "Georgia", value: "Georgia, serif" },
                { label: "Tahoma", value: "Tahoma, Arial, sans-serif" }, { label: "Verdana", value: "Verdana, Arial, sans-serif" },
                { label: "Trebuchet MS", value: "Trebuchet MS, Arial, sans-serif" },
              ]} />
            </Field>
          </div>
        </div>
      </FormSection>

      {/* Cards 2 & 3: Variables (30%) + Email Content (70%) */}
      <div className="flex flex-col lg:flex-row gap-5 flex-1">
        {/* Card 2: Available Variables - 30% */}
        <div className="lg:w-[30%] flex flex-col">
          <FormSection title="Available Variables" icon={<Variable className="h-4 w-4" />}>
            <p className="text-xs text-slate-500 mb-4">Click on a variable to insert it into the content</p>
            <div className="flex flex-wrap gap-2">
              {EMAIL_VARIABLES.map((variable) => (
                <Badge
                  key={variable.key}
                  color="slate"
                  size="sm"
                  className="cursor-pointer hover:bg-slate-200 transition-colors"
                  onClick={() => setPendingInsert(`{{${variable.key}}}`)}
                >
                  {variable.label}
                </Badge>
              ))}
            </div>
          </FormSection>
        </div>

        {/* Card 3: Email Content / Live Preview - 70% */}
        <div className="lg:w-[70%] flex flex-col">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col flex-1">
            <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100">
              <span className="text-emerald-600">
                {isPreviewMode ? <Eye className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
              </span>
              <h3 className="text-sm font-semibold text-slate-900">
                {isPreviewMode ? "Live Client Preview" : "Email Content"}
              </h3>
            </div>

            {/* Preview — always mounted, hidden when not in preview mode */}
            <div className={isPreviewMode ? "block p-4 md:p-5" : "hidden"}>
              <EmailLivePreview
                subject={previewData?.subject ?? formData.subject}
                content={previewData?.content ?? formData.content}
                variables={previewData?.variables ?? formData.variables}
                copyright={previewData?.copyright ?? formData.copyright}
                contactEmail={previewData?.contactEmail ?? formData.contactEmail}
                logoUrl={previewData?.logoUrl ?? formData.logoUrl}
                renderedSubject={previewData?.subject}
                renderedHtml={previewData?.content}
              />
              {isPreviewLoading && (
                <div className="mt-3">
                  <Loading text="Rendering preview..." />
                </div>
              )}
            </div>

            {/* Edit form — always mounted, hidden when in preview mode */}
            <div className={isPreviewMode ? "hidden" : "p-4 md:p-5 flex-1 flex flex-col gap-4"}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Template Name" required error={errors.name}>
                    <Input
                      value={formData.name}
                      onChange={(e) => handleInputChange("name", e.target.value)}
                      placeholder="Enter template name"
                    />
                  </Field>
                  <Field label="Template Type" required error={errors.type}>
                    <Select
                      value={formData.type}
                      onChange={(value) => handleInputChange("type", value)}
                      options={templateTypeOptions.map(([key, config]) => ({
                        label: config.label,
                        value: key
                      }))}
                    />
                  </Field>
                </div>

                <Field label="Email Subject" required error={errors.subject}>
                  <Input
                    value={formData.subject}
                    onChange={(e) => handleInputChange("subject", e.target.value)}
                    placeholder="Enter email subject line"
                  />
                </Field>

                <Field label="Description">
                  <Textarea
                    value={formData.description}
                    onChange={(e) => handleInputChange("description", e.target.value)}
                    placeholder="Describe the purpose of this template"
                    rows={2}
                  />
                </Field>

                <div className="flex-1 flex flex-col">
                  <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">
                    Content <span className="text-red-500">*</span>
                  </label>
                  <LexicalEditor
                    value={formData.content}
                    onChange={(value) => handleInputChange("content", value)}
                    placeholder="Enter email content with rich formatting..."
                    minHeight={480}
                    insertText={pendingInsert}
                    onInsertHandled={() => setPendingInsert(undefined)}
                    logoUrl={formData.logoUrl}
                  />
                  {errors.content && (
                    <p className="text-xs text-red-500 mt-1.5">{errors.content}</p>
                  )}
                  <p className="text-2xs sm:text-xs font-normal text-slate-400 flex items-center gap-1">
                    {'Use variables like {{userName}}, {{companyName}} etc. in your content'}
                  </p>
                  <p className="text-2xs sm:text-xs font-normal text-slate-400 mt-1 flex items-center gap-1">
                    {`Detected variables: ${formData.variables.length ? formData.variables.map((v) => `{{${v}}}`).join(", ") : "None"}`}
                  </p>
                </div>
            </div>
          </div>
        </div>
      </div>

      {/* Save Confirmation Modal */}
      <AlertModal
        isOpen={showSaveConfirm}
        onClose={() => setShowSaveConfirm(false)}
        onConfirm={() => { setShowSaveConfirm(false); setShowESign(true); }}
        type="confirm"
        title="Save Template"
        description="Are you sure you want to save this email template? You will need to sign electronically to confirm."
        confirmText="Continue"
        cancelText="Cancel"
        showCancel
      />

      {/* E-Signature Modal */}
      <ESignatureModal
        isOpen={showESign}
        onClose={() => setShowESign(false)}
        onConfirm={handleESignConfirm}
        actionTitle="Create Email Template"
        meaningDisplayName="Email Template Created"
        meaningCode="EMAIL_TEMPLATE_CREATED"
      />

      {/* Cancel Confirmation Modal */}
      <NavigationGuardModal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={handleCancelConfirm}
        mode="discard"
        currentPageTitle="Email Template"
        title="Discard unsaved changes?"
        primaryActionLabel="Discard changes"
        secondaryActionLabel="Keep editing"
      />

      {(isNavigating || isSubmitting) && (
        <Loading fullPage text={isSubmitting ? "Saving Template..." : "Loading..."} />
      )}
    </div>
  );
};
