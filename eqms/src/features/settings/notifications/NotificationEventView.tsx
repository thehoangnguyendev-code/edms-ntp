import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  BellRing,
  Eye,
  Mail,
  Palette,
  Pencil,
  Send,
  Truck,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { TabNav, type TabItem } from "@/components/ui/tabs/TabNav";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { FormSection } from "@/components/ui/form/FormSection";
import { FormField, Input } from "@/components/ui/form/ResponsiveForm";
import { ReadOnlyField } from "@/components/ui/form/ReadOnlyField";
import { FormModal } from "@/components/ui/modal/FormModal";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { FullPageLoading } from "@/components/ui/loading/Loading";
import { useToast } from "@/components/ui/toast/Toast";
import { usePermissions } from "@/hooks/usePermissions";
import { useDebounce } from "@/hooks";
import { notificationEvent as breadcrumb } from "@/components/ui/breadcrumb/breadcrumbs/settings";
import { ROUTES } from "@/app/routes.constants";
import { formatDateTime } from "@/utils/format";
import { getApiErrorMessage } from "@/utils/apiError";
import {
  notificationPolicyApi,
  type NotificationPolicyDetail,
  type NotificationTemplateVersion,
  type NotificationVariable,
} from "@/services/api/notificationPolicy";
import {
  PRIORITY_COLOR,
  channelList,
  moduleLabel,
  priorityLabel,
} from "./labels";
import {
  RichTextEditor,
  type RichTextEditorHandle,
} from "./components/RichTextEditor";
import {
  TokenTextField,
  type TokenTextFieldHandle,
} from "./components/TokenTextField";
import { VariablePalette } from "./components/VariablePalette";
import { NotificationIconPicker } from "./components/NotificationIconPicker";
import {
  getNotificationTypeIcon,
  getNotificationTypeIconStyles,
} from "@/features/notifications/notificationMeta";
import {
  ChosenIcon,
  resolveIcon,
  useIconLibraries,
} from "@/features/notifications/notificationIcons";
import {
  notificationAdministrationApi,
  type RecipientRuleKind,
} from "@/services/api/notificationAdministration";
import {
  DeliverySettings,
  EMPTY_DELIVERY,
  channelOn,
  deliveryChanges,
  deliveryDirty,
  deliveryOf,
  deliveryProblem,
  type DeliveryForm,
} from "./components/DeliverySettings";
import {
  DeviceSwitch,
  EmailPreviewFrame,
} from "./components/EmailPreviewFrame";
import { sameHtml } from "./sameHtml";
import { useLeaveGuard } from "./useLeaveGuard";
import {
  CHANGED_BY_OTHERS_TEXT,
  CHANGED_BY_OTHERS_TITLE,
  isChangedByOthers,
} from "./changedByOthers";
import { IconInfoCircle, IconPencilMinus } from "@tabler/icons-react";

/** The two parts of the screen: what the notification says (and how it looks), and to whom it is sent. The placeholders belong to the first. */
const TABS: TabItem[] = [
  { id: "content", label: "Content" },
  { id: "delivery", label: "Delivery" },
];

type Field = "title" | "summary" | "subject" | "body" | "label";

interface Appearance {
  icon: string | null;
  tone: string | null;
}

interface Form {
  title: string;
  summary: string;
  url: string;
  subject: string;
  body: string;
  label: string;
}

const EMPTY: Form = {
  title: "",
  summary: "",
  url: "",
  subject: "",
  body: "",
  label: "",
};

const FIELD_LABEL: Record<Field, string> = {
  title: "In-app title",
  summary: "In-app message",
  subject: "Email subject",
  body: "Email message",
  label: "Button label",
};

const formOf = (templates: NotificationTemplateVersion[]): Form => {
  const inApp = templates.find((t) => t.channel === "IN_APP");
  const email = templates.find((t) => t.channel === "EMAIL");
  return {
    title: inApp?.title ?? "",
    summary: inApp?.summary ?? "",
    url: inApp?.actionUrlTemplate ?? "",
    subject: email?.subject ?? "",
    body: email?.body ?? "",
    label: email?.actionLabel ?? "",
  };
};

/** The sample text a placeholder becomes, to show the person what the reader will see. */
const fill = (text: string, samples: Record<string, string>) =>
  text.replace(
    /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
    (_m, name: string) => samples[name] ?? "…",
  );

type RuleKindList = RecipientRuleKind[];

/**
 * One screen for one channel of a notification: the in-app notification (wording, icon, preview, escalation) or the email (wording, preview, timing). The recipients
 * and the on/off of the event are shared and shown on both, the rest is edited only on the channel it belongs to.
 */
export const NotificationEventView: React.FC<{
  channel?: "IN_APP" | "EMAIL";
}> = ({ channel = "IN_APP" }) => {
  const isEmail = channel === "EMAIL";
  const { eventCode = "" } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { hasPermissionAlias } = usePermissions();
  const canManage =
    hasPermissionAlias("settings.notification_policy.manage") ||
    hasPermissionAlias("settings.configuration.manage");

  const [detail, setDetail] = useState<NotificationPolicyDetail | null>(null);
  const [variables, setVariables] = useState<NotificationVariable[]>([]);
  const [systemVariables, setSystemVariables] = useState<
    NotificationVariable[]
  >([]);
  const [ruleKinds, setRuleKinds] = useState<RuleKindList>([]);
  const [delivery, setDelivery] = useState<DeliveryForm>(EMPTY_DELIVERY);
  const [savedDelivery, setSavedDelivery] =
    useState<DeliveryForm>(EMPTY_DELIVERY);
  const [error, setError] = useState("");
  const [form, setForm] = useState<Form>(EMPTY);
  const [saved, setSaved] = useState<Form>(EMPTY);
  // the icon and the tone of its colour: chosen here, saved with Publish (they are not wording)
  const [appearance, setAppearance] = useState<Appearance>({
    icon: null,
    tone: null,
  });
  const [savedAppearance, setSavedAppearance] = useState<Appearance>({
    icon: null,
    tone: null,
  });
  const [saving, setSaving] = useState(false);
  // another administrator saved this notification after it was opened here: the change was refused and the screen offers to reload
  const [changedByOthers, setChangedByOthers] = useState(false);
  const [active, setActive] = useState<Field>(isEmail ? "body" : "title");
  const [tab, setTab] = useState<"content" | "delivery">("content");
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewSubject, setPreviewSubject] = useState("");
  const [mobile, setMobile] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const iconLibraries = useIconLibraries();

  // see EmailMessageEditView: until the person touches the editor, what it gives back is the starting point, not a change
  const bodyPristine = useRef(true);
  const onBodyChange = (value: string) => {
    setForm((prev) => ({ ...prev, body: value }));
    if (bodyPristine.current) setSaved((prev) => ({ ...prev, body: value }));
  };

  const refs = {
    title: useRef<TokenTextFieldHandle>(null),
    summary: useRef<TokenTextFieldHandle>(null),
    subject: useRef<TokenTextFieldHandle>(null),
    label: useRef<TokenTextFieldHandle>(null),
    body: useRef<RichTextEditorHandle>(null),
  };

  // every placeholder of the system, shown at the foot beside the ones this notification offers; a failure only leaves that second list out
  useEffect(() => {
    let live = true;
    notificationAdministrationApi
      .placeholders()
      .then((all) => live && setSystemVariables(all))
      .catch(() => undefined);
    notificationAdministrationApi
      .recipientRules()
      .then((kinds) => live && setRuleKinds(kinds))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  const load = useCallback(async () => {
    try {
      const [d, v] = await Promise.all([
        notificationPolicyApi.getDetail(eventCode),
        notificationPolicyApi.variables(eventCode),
      ]);
      setDetail(d);
      setVariables(v);
      const f = formOf(d.activeTemplates);
      bodyPristine.current = true;
      setForm(f);
      setSaved(f);
      const delivered = deliveryOf(d);
      setDelivery(delivered);
      setSavedDelivery(delivered);
      const look = { icon: d.icon ?? null, tone: d.iconTone ?? null };
      setAppearance(look);
      setSavedAppearance(look);
      setError("");
      setChangedByOthers(false);
    } catch (e) {
      setError(getApiErrorMessage(e, "The notification could not be loaded."));
    }
  }, [eventCode]);

  useEffect(() => {
    void load();
  }, [load]);

  const allowed = useMemo(() => variables.map((v) => v.name), [variables]);
  const samples = useMemo(
    () => Object.fromEntries(variables.map((v) => [v.name, v.sample])),
    [variables],
  );
  const supported = channelList(detail?.supportedChannels);
  const hasEmail = isEmail && supported.includes("EMAIL");
  const readOnly = !canManage;
  const set = (key: keyof Form) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // the address the notification opens is not edited here: it is kept as saved (in form.url) and sent back unchanged
  const dirtyInApp =
    !isEmail && (form.title !== saved.title || form.summary !== saved.summary);
  const dirtyEmail =
    hasEmail &&
    (form.subject !== saved.subject ||
      !sameHtml(form.body, saved.body) ||
      form.label !== saved.label);
  const dirtyAppearance =
    !isEmail &&
    (appearance.icon !== savedAppearance.icon ||
      appearance.tone !== savedAppearance.tone);
  const dirtyDelivery = deliveryDirty(savedDelivery, delivery);
  const dirty = dirtyInApp || dirtyEmail || dirtyAppearance || dirtyDelivery;
  const { go, modal: leaveModal } = useLeaveGuard(
    dirty,
    isEmail ? "Edit Email Notification" : "Edit In-App Notification",
    "another page",
  );

  const insert = (token: string) => {
    if (active === "body") {
      bodyPristine.current = false;
      refs.body.current?.insertText(token);
    } else refs[active].current?.insertText(token);
  };

  // the mail as the reader will get it, in the shared frame, from the server (it owns the frame)
  const previewKey = useDebounce(
    JSON.stringify({
      subject: form.subject,
      body: form.body,
      url: form.url,
      label: form.label,
    }),
    500,
  );
  useEffect(() => {
    if (!detail || !hasEmail) return;
    let live = true;
    const draft = JSON.parse(previewKey) as {
      subject: string;
      body: string;
      url: string;
      label: string;
    };
    notificationPolicyApi
      .preview(eventCode, {
        channel: "EMAIL",
        subject: draft.subject,
        body: draft.body,
        actionUrlTemplate: draft.url,
        actionLabel: draft.label,
      })
      .then((r) => {
        if (!live) return;
        setPreviewHtml(r.renderedHtml ?? "");
        setPreviewSubject(r.renderedSubject ?? "");
      })
      .catch(() => live && setPreviewHtml(""));
    return () => {
      live = false;
    };
  }, [detail, hasEmail, eventCode, previewKey]);

  const problems = (): string | null => {
    if (dirtyDelivery) {
      const delivered = deliveryProblem(delivery);
      if (delivered) return delivered;
    }
    if (dirtyInApp && (!form.title.trim() || !form.summary.trim()))
      return "The in-app notification needs a title and a message.";
    if (dirtyEmail && (!form.subject.trim() || !form.body.trim()))
      return "The email needs a subject and a message.";
    const names = (
      isEmail
        ? [form.subject, form.body, form.label]
        : [form.title, form.summary, form.url]
    ).flatMap((t) =>
      Array.from(t.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)).map((m) => m[1]),
    );
    const unknown = names.find((n) => !allowed.includes(n));
    return unknown
      ? `{{${unknown}}} is not offered by this notification. Use the placeholders on the right.`
      : null;
  };

  const save = async () => {
    if (!detail) return;
    const issue = problems();
    if (issue) {
      if (dirtyDelivery && deliveryProblem(delivery)) setTab("delivery");
      showToast({ type: "error", title: "Cannot save", message: issue });
      return;
    }
    setSaving(true);
    // the time the notification had when it was opened goes with the first change only: that change moves the time, and the changes after it are this person's own
    let opened: string | undefined = detail.updatedAt;
    const once = () => {
      const token = opened;
      opened = undefined;
      return token;
    };
    try {
      // the delivery first: turning the email on gives it wording to start from, which the email wording below then replaces
      if (dirtyDelivery) {
        await notificationPolicyApi.updatePolicy(eventCode, {
          ...deliveryChanges(savedDelivery, delivery),
          expectedUpdatedAt: once(),
        });
      }
      if (dirtyInApp) {
        await notificationPolicyApi.updateTemplate(eventCode, "IN_APP", {
          title: form.title,
          summary: form.summary,
          actionUrlTemplate: form.url || null,
          changeSummary: null,
          expectedUpdatedAt: once(),
        });
      }
      if (dirtyEmail) {
        await notificationPolicyApi.updateTemplate(eventCode, "EMAIL", {
          subject: form.subject,
          body: form.body,
          actionLabel: form.label || null,
          actionUrlTemplate: null,
          changeSummary: null,
          expectedUpdatedAt: once(),
        });
      }
      if (dirtyAppearance) {
        await notificationPolicyApi.updateAppearance(
          eventCode,
          appearance.icon,
          appearance.tone,
          once(),
        );
      }
      showToast({
        type: "success",
        title: "Saved",
        message: "The change is published and recorded in the Audit Trail.",
      });
      await load();
    } catch (e) {
      if (isChangedByOthers(e)) setChangedByOthers(true);
      showToast({
        type: "error",
        title: isChangedByOthers(e)
          ? "Not saved: changed by someone else"
          : "Not saved",
        message: getApiErrorMessage(e, "The wording could not be saved."),
      });
    } finally {
      setSaving(false);
    }
  };

  // the toast of this notification as the reader will get it: the wording being edited (with sample values), its icon and colour, and the duration and
  // position the administrator chose in Configuration (the toast provider applies them)
  const showToastSample = () => {
    const styles = getNotificationTypeIconStyles(eventCode, appearance.tone);
    const priority = (detail?.priority ?? "").toLowerCase();
    showToast({
      type: priority === "high" || priority === "critical" ? "warning" : "info",
      title: fill(form.title, samples) || "Title",
      message: fill(form.summary, samples) || "Message",
      icon:
        resolveIcon(iconLibraries, appearance.icon) ??
        getNotificationTypeIcon(eventCode),
      iconClassName: `${styles.bg} ${styles.text}`,
      iconStyle: styles.tileStyle
        ? { ...styles.tileStyle, ...styles.iconStyle }
        : undefined,
    });
  };

  const sendTest = async () => {
    setSendingTest(true);
    try {
      await notificationPolicyApi.testSend(eventCode, testTo.trim());
      showToast({
        type: "success",
        title: "Test email sent",
        message: `The published email was sent to ${testTo.trim()}.`,
      });
      setTesting(false);
    } catch (e) {
      showToast({
        type: "error",
        title: "Test email not sent",
        message: getApiErrorMessage(e, "The test email could not be sent."),
      });
    } finally {
      setSendingTest(false);
    }
  };

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader
          title={
            isEmail
              ? "Email Notification Details"
              : "In-App Notification Details"
          }
          breadcrumbItems={breadcrumb(navigate, true, channel)}
          actions={
            <Button
              size="sm"
              variant="outline-emerald"
              onClick={() =>
                navigate(
                  `${ROUTES.SETTINGS.NOTIFICATIONS}?tab=${isEmail ? "email" : "in-app"}`,
                )
              }
            >
              Back
            </Button>
          }
        />
        <WarningBanner
          variant="error"
          title="Unable to open this notification."
          description={error}
        />
      </div>
    );
  }
  if (!detail) return <FullPageLoading text="Loading notification…" />;
  if (isEmail && !supported.includes("EMAIL")) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader
          title="Email Notification Details"
          breadcrumbItems={breadcrumb(navigate, true, channel)}
          actions={
            <Button
              size="sm"
              variant="outline-emerald"
              onClick={() =>
                navigate(`${ROUTES.SETTINGS.NOTIFICATIONS}?tab=email`)
              }
            >
              Back
            </Button>
          }
        />
        <WarningBanner
          variant="error"
          title="This notification has no email."
          description="It can only be sent in the application."
        />
      </div>
    );
  }

  const others = systemVariables.filter(
    (all) => !variables.some((offered) => offered.name === all.name),
  );
  const emailHasWording = Boolean(saved.subject && saved.body);
  const channelIsOn = channelOn(savedDelivery, channel);
  const channelStatus =
    detail.policyStatus === "DRAFT"
      ? "Draft"
      : channelIsOn
        ? "Active"
        : "Inactive";
  const previewStyles = getNotificationTypeIconStyles(
    eventCode,
    appearance.tone,
  );
  const title = isEmail
    ? canManage
      ? "Edit Email Notification"
      : "Email Notification Details"
    : canManage
      ? "Edit In-App Notification"
      : "In-App Notification Details";
  const backPath = `${ROUTES.SETTINGS.NOTIFICATIONS}?tab=${isEmail ? "email" : "in-app"}`;
  // the same notification on its other channel: one button instead of looking for it in the other list
  const otherChannel =
    supported.includes("IN_APP") && supported.includes("EMAIL");
  const goToOther = () =>
    go(
      isEmail
        ? ROUTES.SETTINGS.NOTIFICATIONS_EVENT(eventCode)
        : ROUTES.SETTINGS.NOTIFICATIONS_EVENT_EMAIL(eventCode),
    );

  // the same buttons above and under the screen, so that they are at hand wherever the person is on a long page
  const actionButtons = (
    <>
      <Button
        size="sm"
        variant="outline-emerald"
        className="whitespace-nowrap"
        onClick={() => go(backPath)}
      >
        Back
      </Button>
      {!isEmail ? (
        <Button
          size="sm"
          variant="outline-emerald"
          onClick={showToastSample}
          title="Show the toast of this notification with the wording and icon being edited"
        >
          Test Notification
        </Button>
      ) : null}
      {canManage && hasEmail ? (
        <Button
          size="sm"
          variant="outline-emerald"
          disabled={!emailHasWording}
          onClick={() => setTesting(true)}
          title={
            emailHasWording
              ? "Send the published email to an address"
              : "Write and publish the email first"
          }
        >
          Send Test
        </Button>
      ) : null}
      {otherChannel ? (
        <Button
          size="sm"
          variant="outline-emerald"
          onClick={goToOther}
          title={
            isEmail
              ? "Open the in-app notification of this event"
              : "Open the email of this event"
          }
        >
          {isEmail ? "In-app Notification" : "Email Notification"}
        </Button>
      ) : null}

      {canManage ? (
        <>
          <Button
            size="sm"
            variant="outline-emerald"
            disabled={!dirty || saving}
            onClick={() => {
              setForm(saved);
              setAppearance(savedAppearance);
              setDelivery(savedDelivery);
            }}
          >
            Discard Changes
          </Button>
          <Button
            size="sm"
            variant="outline-emerald"
            className="whitespace-nowrap"
            disabled={!dirty || saving}
            onClick={() => void save()}
          >
            {saving ? "Saving…" : "Publish"}
          </Button>
        </>
      ) : null}
    </>
  );

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <PageHeader
        title={title}
        breadcrumbItems={breadcrumb(navigate, !canManage, channel)}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {actionButtons}
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
              Reload
            </Button>
          </div>
        </WarningBanner>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <TabNav
          tabs={TABS}
          activeTab={tab}
          onChange={(id) => setTab(id as "content" | "delivery")}
          ariaLabel="Notification sections"
          layoutId="notification-event-tabs"
        />

        <div className="p-4 md:p-5">
          {tab === "content" ? (
            <>
              <div className="grid grid-cols-1 gap-4 md:gap-5 xl:grid-cols-2">
                <div className="flex min-w-0 flex-col gap-4 md:gap-5">
                  <FormSection
                    title="Notification Information"
                    icon={<IconInfoCircle className="h-4 w-4" />}
                    headerRight={
                      <>
                        <Badge
                          color={PRIORITY_COLOR[detail.priority] ?? "slate"}
                          size="sm"
                        >
                          {priorityLabel(detail.priority)}
                        </Badge>
                      </>
                    }
                  >
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <FormField label="Event">
                        <ReadOnlyField value={detail.name} />
                      </FormField>
                      <FormField label="Event Code">
                        <ReadOnlyField value={detail.eventCode} />
                      </FormField>
                      <FormField label="Module">
                        <ReadOnlyField value={moduleLabel(detail.module)} />
                      </FormField>
                      <FormField label="Status">
                        <ReadOnlyField value={channelStatus} />
                      </FormField>
                      <FormField label="Updated">
                        <ReadOnlyField
                          value={formatDateTime(detail.updatedAt)}
                        />
                      </FormField>
                      {detail.description ? (
                        <FormField
                          label="Description"
                          className="md:col-span-2"
                        >
                          <ReadOnlyField
                            value={detail.description}
                            className="h-auto min-h-9 py-2"
                          />
                        </FormField>
                      ) : null}
                    </div>
                  </FormSection>

                  {!isEmail ? (
                    <>
                      <FormSection
                        className="flex-1"
                        title="In-App Wording"
                        icon={<IconPencilMinus className="h-4 w-4" />}
                      >
                        <div className="space-y-4">
                          <FormField
                            label={FIELD_LABEL.title}
                            htmlFor="wf-title"
                          >
                            <TokenTextField
                              id="wf-title"
                              ref={refs.title}
                              ariaLabel={FIELD_LABEL.title}
                              value={form.title}
                              onChange={set("title")}
                              allowedTokens={allowed}
                              maxLength={255}
                              disabled={readOnly}
                              onFocus={() => setActive("title")}
                            />
                          </FormField>
                          <FormField
                            label={FIELD_LABEL.summary}
                            htmlFor="wf-summary"
                          >
                            <TokenTextField
                              id="wf-summary"
                              ref={refs.summary}
                              ariaLabel={FIELD_LABEL.summary}
                              value={form.summary}
                              onChange={set("summary")}
                              allowedTokens={allowed}
                              multiline
                              rows={3}
                              maxLength={500}
                              disabled={readOnly}
                              onFocus={() => setActive("summary")}
                            />
                          </FormField>
                        </div>
                      </FormSection>
                    </>
                  ) : null}

                  {hasEmail ? (
                    <FormSection
                      className="flex-1"
                      title="Email Wording"
                      icon={<Mail className="h-4 w-4" />}
                    >
                      <div className="space-y-4">
                        <FormField
                          label={FIELD_LABEL.subject}
                          htmlFor="wf-subject"
                        >
                          <TokenTextField
                            id="wf-subject"
                            ref={refs.subject}
                            ariaLabel={FIELD_LABEL.subject}
                            value={form.subject}
                            onChange={set("subject")}
                            allowedTokens={allowed}
                            maxLength={255}
                            disabled={readOnly}
                            onFocus={() => setActive("subject")}
                          />
                        </FormField>
                        <FormField label={FIELD_LABEL.body}>
                          <RichTextEditor
                            ref={refs.body}
                            ariaLabel={FIELD_LABEL.body}
                            value={form.body}
                            onChange={onBodyChange}
                            allowedTokens={allowed}
                            disabled={readOnly}
                            onFocus={() => {
                              bodyPristine.current = false;
                              setActive("body");
                            }}
                            placeholder="Write the message of the email…"
                          />
                        </FormField>
                        <FormField
                          label={FIELD_LABEL.label}
                          htmlFor="wf-label"
                          hint="The button opens the same page as the in-app notification."
                        >
                          <TokenTextField
                            id="wf-label"
                            ref={refs.label}
                            ariaLabel={FIELD_LABEL.label}
                            value={form.label}
                            onChange={set("label")}
                            maxLength={80}
                            placeholder="Open in EQMS"
                            disabled={readOnly}
                            onFocus={() => setActive("label")}
                          />
                        </FormField>
                      </div>
                    </FormSection>
                  ) : null}
                </div>

                <div className="flex min-w-0 flex-col gap-4 md:gap-5">
                  <FormSection
                    className={isEmail ? "flex-1" : undefined}
                    title="Preview"
                    icon={<Eye className="h-4 w-4" />}
                    headerRight={
                      isEmail ? (
                        <DeviceSwitch mobile={mobile} onChange={setMobile} />
                      ) : undefined
                    }
                  >
                    <div
                      aria-label="Preview"
                      className="space-y-4 rounded-xl bg-slate-100 p-3 sm:p-4"
                    >
                      {!isEmail ? (
                        <div className="mx-auto flex w-full max-w-md items-start gap-3 overflow-hidden rounded-xl border border-slate-200 bg-white p-3">
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${previewStyles.bg} ${previewStyles.text}`}
                            style={previewStyles.tileStyle}
                          >
                            <ChosenIcon
                              icon={appearance.icon}
                              fallback={getNotificationTypeIcon(eventCode)}
                              className="h-4 w-4"
                              style={previewStyles.iconStyle}
                            />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-slate-900 [overflow-wrap:anywhere]">
                              {fill(form.title, samples) || "Title"}
                            </p>
                            <p className="mt-0.5 whitespace-pre-line text-xs text-slate-600 [overflow-wrap:anywhere]">
                              {fill(form.summary, samples) || "Message"}
                            </p>
                            <p className="mt-1 text-xs text-slate-400">
                              2 minutes ago
                            </p>
                          </div>
                          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                        </div>
                      ) : null}
                      {hasEmail ? (
                        <div className="space-y-2">
                          <p className="min-w-0 truncate text-xs text-slate-600">
                            <span className="font-semibold">
                              Email subject:
                            </span>{" "}
                            {previewSubject || "…"}
                          </p>
                          <EmailPreviewFrame
                            html={previewHtml}
                            mobile={mobile}
                          />
                        </div>
                      ) : null}
                    </div>
                  </FormSection>

                  {!isEmail ? (
                    <FormSection
                      className="flex-1"
                      title="Notification Icon"
                      icon={<Palette className="h-4 w-4" />}
                    >
                      <NotificationIconPicker
                        icon={appearance.icon}
                        tone={appearance.tone}
                        fallback={getNotificationTypeIcon(eventCode)}
                        fallbackStyles={getNotificationTypeIconStyles(
                          eventCode,
                          null,
                        )}
                        onChange={(icon, tone) => setAppearance({ icon, tone })}
                        disabled={readOnly}
                      />
                    </FormSection>
                  ) : null}
                </div>
              </div>
            </>
          ) : (
            <DeliverySettings
              channel={channel}
              form={delivery}
              onChange={setDelivery}
              supportedChannels={supported}
              kinds={ruleKinds}
              disabled={readOnly}
              intro={
                isEmail
                  ? "Whether the email is sent, to whom, and when. Every change is recorded in the Audit Trail."
                  : "Whether the notification is shown, to whom, and when it escalates. Every change is recorded in the Audit Trail."
              }
            />
          )}
        </div>
      </div>

      {/* the actions at the foot, as on a document: the same buttons as in the header */}
      <div className="flex flex-wrap items-center gap-2 md:gap-3">
        {actionButtons}
      </div>

      {/* under the actions, as the lists of a document: the placeholders, only while the first tab is open (only its wording uses them) */}
      {tab === "content" && canManage ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <TabNav
            tabs={[
              {
                id: "placeholders",
                label: "Placeholders",
                count: variables.length + others.length,
              },
            ]}
            activeTab="placeholders"
            onChange={() => undefined}
            ariaLabel="Lists"
            layoutId="notification-event-lists"
          />
          <div className="p-4 md:p-5">
            <VariablePalette
              bare
              variables={variables}
              others={others}
              onInsert={insert}
              target={FIELD_LABEL[active]}
              loading={variables.length === 0 && !detail.availableVariables}
            />
          </div>
        </div>
      ) : null}

      {leaveModal}

      <FormModal
        isOpen={testing}
        onClose={() => setTesting(false)}
        onConfirm={() => void sendTest()}
        title="Send a test email"
        description="The published email is sent with example values, so you can see it in a real inbox. Nothing is recorded as a notification."
        confirmText="Send test"
        isLoading={sendingTest}
        confirmDisabled={
          !/^[^@\s<>"]+@[^@\s<>"]+\.[^@\s<>"]+$/.test(testTo.trim())
        }
        size="md"
      >
        <FormField label="Send to" htmlFor="test-to">
          <Input
            id="test-to"
            type="email"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            placeholder="name@company.example"
          />
        </FormField>
      </FormModal>
    </div>
  );
};
