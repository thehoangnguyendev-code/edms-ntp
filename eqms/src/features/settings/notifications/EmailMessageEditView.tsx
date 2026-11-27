import { navigateBack } from "@/app/navigation/backNavigation";
import { tr as __ariaTr } from "@/i18n";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Eye, Mail, Pencil } from "lucide-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { Switch } from "@/components/ui/switch";
import { FormSection } from "@/components/ui/form/FormSection";
import { FormField } from "@/components/ui/form/ResponsiveForm";
import { ReadOnlyField } from "@/components/ui/form/ReadOnlyField";
import { formatDateTime } from "@/utils/format";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { FullPageLoading } from "@/components/ui/loading/Loading";
import { useToast } from "@/components/ui/toast/Toast";
import { usePermissions } from "@/hooks/usePermissions";
import { useDebounce } from "@/hooks";
import { notificationEmail as breadcrumb } from "@/components/ui/breadcrumb/breadcrumbs/settings";
import { ROUTES } from "@/app/routes.constants";
import { getApiErrorMessage } from "@/utils/apiError";
import { emailTemplateApi } from "@/services/api/emailTemplates";
import type { NotificationVariable } from "@/services/api/notificationPolicy";
import { EMAIL_VARIABLES } from "./emailTemplateConstants";
import type { EmailTemplate } from "./emailTemplateTypes";
import {
  RichTextEditor,
  type RichTextEditorHandle,
} from "./components/RichTextEditor";
import {
  TokenTextField,
  type TokenTextFieldHandle,
} from "./components/TokenTextField";
import { VariablePalette } from "./components/VariablePalette";
import {
  DeviceSwitch,
  EmailPreviewFrame,
} from "./components/EmailPreviewFrame";
import { sameHtml } from "./sameHtml";
import { useLeaveGuard } from "@/hooks/useLeaveGuard";
import {
  CHANGED_BY_OTHERS_TEXT,
  CHANGED_BY_OTHERS_TITLE,
  isChangedByOthers,
} from "./changedByOthers";
import {
  notificationAdministrationApi,
  type MessageEvent,
} from "@/services/api/notificationAdministration";
import { tr, trFormat } from "@/i18n";

type Field = "subject" | "content";

const humanise = (name: string) =>
  name.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());

/**
 * Every placeholder the system knows, plus the ones this message uses that the shared list does not know (a message may carry its own, for
 * example {itemLabel}); the ones the message already uses come first, so the person sees them without looking for them.
 */
const paletteFor = (template: EmailTemplate): NotificationVariable[] => {
  const used = template.variables ?? [];
  const known = EMAIL_VARIABLES.map((v) => ({
    name: v.key,
    token: `{{${v.key}}}`,
    label: v.label,
    sample: v.example,
  }));
  const own = used
    .filter((name) => !known.some((v) => v.name === name))
    .map((name) => ({
      name,
      token: `{{${name}}}`,
      label: humanise(name),
      sample: `[${name}]`,
    }));
  const all = [...known, ...own];
  return [
    ...all.filter((v) => used.includes(v.name)),
    ...all.filter((v) => !used.includes(v.name)),
  ];
};

/**
 * One email message of the system (a password reset, a review request…): its subject and wording are edited, signed and published. The message
 * itself is fixed (the code finds it by its type), and its look is the shared Email Design.
 */
export const EmailMessageEditView: React.FC = () => {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { hasPermissionAlias } = usePermissions();
  const canManage =
    hasPermissionAlias("settings.email_template.manage");

  const [template, setTemplate] = useState<EmailTemplate | null>(null);
  const [error, setError] = useState("");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [active, setActive] = useState(true);
  const [saved, setSaved] = useState({
    subject: "",
    content: "",
    active: true,
  });
  const [active_, setActiveField] = useState<Field>("content");
  const [previewHtml, setPreviewHtml] = useState("");
  // the notification of the registry this message started (a message of a type that is also an event), so the person is sent to where it is really edited
  const [messageEvent, setMessageEvent] = useState<MessageEvent | null>(null);
  const [systemVariables, setSystemVariables] = useState<
    NotificationVariable[]
  >([]);
  const [mobile, setMobile] = useState(false);
  const [saving, setSaving] = useState(false);
  const subjectRef = useRef<TokenTextFieldHandle>(null);
  const contentRef = useRef<RichTextEditorHandle>(null);
  // until the person touches the editor, what it gives back is its own way of writing the saved text (it drops the wrapper and the styles of an older message): that is the
  // starting point to compare with, not a change
  const [changedByOthers, setChangedByOthers] = useState(false);
  const editorPristine = useRef(true);
  const onContentChange = (value: string) => {
    setContent(value);
    if (editorPristine.current)
      setSaved((prev) => ({ ...prev, content: value }));
  };

  // every placeholder of the system, shown at the foot beside the ones this message uses; a failure only leaves that second list out
  useEffect(() => {
    let live = true;
    notificationAdministrationApi
      .placeholders()
      .then((all) => live && setSystemVariables(all))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  const load = async () => {
    try {
      const t = await emailTemplateApi.getEmailTemplate(id);
      editorPristine.current = true;
      setChangedByOthers(false);
      setTemplate(t);
      const state = {
        subject: t.subject,
        content: t.content,
        active: t.status === "Active",
      };
      setSubject(state.subject);
      setContent(state.content);
      setActive(state.active);
      setSaved(state);
      setError("");
    } catch (e) {
      setError(getApiErrorMessage(e, "The email message could not be loaded."));
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!template) return;
    let live = true;
    notificationAdministrationApi
      .messageEvents()
      .then(
        (all) =>
          live &&
          setMessageEvent(
            all.find((e) => e.messageType === template.type) ?? null,
          ),
      )
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [template?.type]); // eslint-disable-line react-hooks/exhaustive-deps

  const variables = useMemo(
    () => (template ? paletteFor(template) : []),
    [template],
  );
  const dirty =
    subject !== saved.subject ||
    !sameHtml(content, saved.content) ||
    active !== saved.active;
  const { go, modal: leaveModal } = useLeaveGuard(dirty, "Edit Email Message");

  const previewKey = useDebounce(JSON.stringify({ subject, content }), 500);
  useEffect(() => {
    if (!template) return;
    let live = true;
    const draft = JSON.parse(previewKey) as {
      subject: string;
      content: string;
    };
    // the wording is not loaded yet while the debounced key still holds the empty first value: nothing to show, and the server refuses an empty message
    if (!draft.subject && !draft.content) return;
    const sample = Object.fromEntries(
      paletteFor(template).map((v) => [v.name, v.sample]),
    );
    emailTemplateApi
      .previewDraftEmailTemplate({
        name: template.name,
        type: template.type,
        subject: draft.subject,
        content: draft.content,
        status: template.status,
        variables: template.variables ?? [],
        sampleVariables: sample,
      })
      .then((r) => live && setPreviewHtml(r.content))
      .catch(() => live && setPreviewHtml(""));
    return () => {
      live = false;
    };
  }, [template, previewKey]);

  const insert = (token: string) => {
    if (active_ === "subject") subjectRef.current?.insertText(token);
    else {
      editorPristine.current = false;
      contentRef.current?.insertText(token);
    }
  };

  const save = async () => {
    if (!template) return;
    setSaving(true);
    try {
      await emailTemplateApi.updateEmailTemplate(template.id, {
        name: template.name,
        type: template.type,
        subject,
        content,
        status: active ? "Active" : "Inactive",
        variables: template.variables ?? [],
        description: template.description,
        expectedUpdatedDate: template.updatedDate,
      });
      showToast({
        type: "success",
        title: "Saved",
        message:
          tr("The email message is saved. The change is recorded in the Audit Trail."),
      });
      await load();
    } catch (e) {
      if (isChangedByOthers(e)) setChangedByOthers(true);
      showToast({
        type: "error",
        title: isChangedByOthers(e)
          ? tr("Not saved: changed by someone else")
          : "Not saved",
        message: getApiErrorMessage(e, "The email message could not be saved."),
      });
    } finally {
      setSaving(false);
    }
  };

  const back = () => navigateBack(go, null, `${ROUTES.SETTINGS.NOTIFICATIONS}?tab=email`);

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader
          title={tr("Email Message Details")}
          breadcrumbItems={breadcrumb(navigate, true)}
          actions={
            <Button size="sm" variant="outline-emerald" onClick={back}>
              {tr("Back")}
            </Button>
          }
        />
        <WarningBanner
          variant="error"
          title={tr("Unable to open this email message.")}
          description={error}
        />
      </div>
    );
  }
  if (!template) return <FullPageLoading text="Loading email message…" />;

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <PageHeader
        title={canManage ? tr("Edit Email Message") : tr("Email Message Details")}
        breadcrumbItems={breadcrumb(navigate, !canManage)}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline-emerald" onClick={back}>
              {tr("Back")}
            </Button>
            {canManage ? (
              <>
                <Button
                  size="sm"
                  variant="outline-emerald"
                  disabled={!dirty || saving}
                  onClick={() => {
                    setSubject(saved.subject);
                    setContent(saved.content);
                    setActive(saved.active);
                  }}
                >
                  {tr("Discard Changes")}
                </Button>
                <Button
                  size="sm"
                  variant="outline-emerald"
                  className="whitespace-nowrap"
                  disabled={
                    !dirty || saving || !subject.trim() || !content.trim()
                  }
                  onClick={() => void save()}
                >
                  {saving ? "Saving…" : "Save"}
                </Button>
              </>
            ) : null}
          </div>
        }
      />

      {changedByOthers ? (
        <WarningBanner
          variant="warning"
          title={CHANGED_BY_OTHERS_TITLE}
          description={CHANGED_BY_OTHERS_TEXT}
        >
          <div className="mt-3">
            <Button
              size="sm"
              variant="outline-emerald"
              onClick={() => void load()}
            >
              {tr("Reload")}
            </Button>
          </div>
        </WarningBanner>
      ) : null}

      {messageEvent ? (
        <WarningBanner
          variant="info"
          title={`The notification itself is edited as "${messageEvent.name}".`}
          description={tr("This message is now used only for an e-mail to an address outside the system, and as the wording the notification started from. Changing it does not change the notification, and switching it off does not stop it.")}
        >
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline-emerald"
              onClick={() =>
                go(ROUTES.SETTINGS.NOTIFICATIONS_EVENT(messageEvent.code))
              }
            >
              {tr("Edit In-App Notification")}
            </Button>
            <Button
              size="sm"
              variant="outline-emerald"
              onClick={() =>
                go(ROUTES.SETTINGS.NOTIFICATIONS_EVENT_EMAIL(messageEvent.code))
              }
            >
              {tr("Edit Email Notification")}
            </Button>
          </div>
        </WarningBanner>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:gap-5 xl:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-4 md:gap-5">
          <FormSection
            title={tr("Email Message Information")}
            icon={<Mail className="h-4 w-4" />}
          >
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField label={tr("Message")}>
                  <ReadOnlyField value={template.name} />
                </FormField>
                <FormField label={tr("Type")}>
                  <ReadOnlyField value={template.type} />
                </FormField>
                <FormField label={tr("Sent")}>
                  <ReadOnlyField value={trFormat("{count} time(s)", { count: template.usageCount })} />
                </FormField>
                <FormField label={tr("Updated")}>
                  <ReadOnlyField
                    value={
                      template.updatedDate
                        ? formatDateTime(template.updatedDate)
                        : null
                    }
                  />
                </FormField>
                {template.description ? (
                  <FormField label={tr("Description")} className="md:col-span-2">
                    <ReadOnlyField
                      value={template.description}
                      className="h-auto min-h-9 py-2"
                    />
                  </FormField>
                ) : null}
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <div className="min-w-0">
                  <span className="text-xs font-medium text-slate-700 sm:text-sm">
                    {tr("Active")}
                  </span>
                  <p className="mt-1.5 text-xs text-slate-500">
                    {tr("When turned off, the system does not send this email.")}
                  </p>
                </div>
                <Switch
                  size="sm"
                  checked={active}
                  disabled={!canManage}
                  aria-label={tr("Active")}
                  onChange={setActive}
                />
              </div>
            </div>
          </FormSection>

          <FormSection
            title={tr("Email Wording")}
            icon={<Pencil className="h-4 w-4" />}
            description={tr("The logo, colour and footer come from the shared Email Design.")}
          >
            <div className="space-y-4">
              <FormField label={tr("Email subject")} htmlFor="em-subject">
                <TokenTextField
                  id="em-subject"
                  ref={subjectRef}
                  ariaLabel={__ariaTr("Email subject")}
                  value={subject}
                  onChange={setSubject}
                  maxLength={200}
                  disabled={!canManage}
                  onFocus={() => setActiveField("subject")}
                />
              </FormField>
              <FormField label={tr("Email message")}>
                <RichTextEditor
                  ref={contentRef}
                  ariaLabel={__ariaTr("Email message")}
                  value={content}
                  onChange={onContentChange}
                  disabled={!canManage}
                  onFocus={() => {
                    editorPristine.current = false;
                    setActiveField("content");
                  }}
                  placeholder={tr("Write the message of the email…")}
                />
              </FormField>
            </div>
          </FormSection>
        </div>

        <div className="flex min-w-0 flex-col gap-4 md:gap-5">
          <FormSection
            title={tr("Preview")}
            icon={<Eye className="h-4 w-4" />}
            headerRight={<DeviceSwitch mobile={mobile} onChange={setMobile} />}
          >
            <div aria-label={tr("Preview")}>
              <EmailPreviewFrame html={previewHtml} mobile={mobile} />
            </div>
          </FormSection>
        </div>
      </div>

      {canManage ? (
        <VariablePalette
          variables={variables}
          others={systemVariables.filter(
            (all) =>
              !variables.some(
                (offered) =>
                  offered.name.toLowerCase() === all.name.toLowerCase(),
              ),
          )}
          onInsert={insert}
          target={active_ === "subject" ? tr("Email subject") : tr("Email message")}
        />
      ) : null}

      {leaveModal}
    </div>
  );
};
