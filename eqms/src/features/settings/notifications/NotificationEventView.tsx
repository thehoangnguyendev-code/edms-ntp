import { navigateBack } from "@/app/navigation/backNavigation";
import { useViewState } from "@/hooks/useViewState";
import { tr as __ariaTr } from "@/i18n";
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
import { Select } from "@/components/ui/select";
import {
  PRIORITY_CHOICES,
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
  getNotificationIconStyles,
  getNotificationPriorityHex,
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
import { useVietnameseWording } from "./components/useVietnameseWording";
import { sameHtml } from "./sameHtml";
import { useLeaveGuard } from "@/hooks/useLeaveGuard";
import {
  CHANGED_BY_OTHERS_TEXT,
  CHANGED_BY_OTHERS_TITLE,
  isChangedByOthers,
} from "./changedByOthers";
import { IconInfoCircle, IconPencilMinus } from "@tabler/icons-react";
import { tr, trFormat } from "@/i18n";

/** The two parts of the screen: what the notification says (and how it looks), and to whom it is sent. The placeholders belong to the first. */
const TABS: TabItem[] = [
  { id: "content", label: "Content" },
  { id: "delivery", label: "Delivery" },
];

type Field = "title" | "summary" | "subject" | "body" | "label";

interface Appearance {
  icon: string | null;
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
  get title() { return tr("In-app title"); },
  get summary() { return tr("In-app message"); },
  subject: "Email subject",
  body: "Email message",
  get label() { return tr("Button label"); },
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
    hasPermissionAlias("settings.notification_policy.manage");

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
  // the icon: chosen here, saved with Save (it is not wording). Its colour follows the priority.
  const [appearance, setAppearance] = useState<Appearance>({ icon: null });
  const [savedAppearance, setSavedAppearance] = useState<Appearance>({ icon: null });
  const [saving, setSaving] = useState(false);
  // another administrator saved this notification after it was opened here: the change was refused and the screen offers to reload
  const [changedByOthers, setChangedByOthers] = useState(false);
  const [active, setActive] = useState<Field>(isEmail ? "body" : "title");
  const [tab, setTab] = useViewState<"content" | "delivery">("NotificationEventView.tab", "content");
  // the language of the wording and of the preview; the Vietnamese wording is read when its tab is opened for the first time
  const [language, setLanguage] = useState<"en" | "vi">("en");
  const [viOpened, setViOpened] = useState(false);
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
      const look = { icon: d.icon ?? null };
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
  /** The priority of the event in the catalog: what a notification goes back to, and the only case in which Critical is offered. */
  const defaultPriority = (detail?.defaultPriority ?? detail?.priority ?? "MEDIUM").toUpperCase();
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
    appearance.icon !== savedAppearance.icon;
  const dirtyDelivery = deliveryDirty(savedDelivery, delivery);
  const dirty = dirtyInApp || dirtyEmail || dirtyAppearance || dirtyDelivery;
  const vietnamese = useVietnameseWording({ eventCode, channel: isEmail ? "EMAIL" : "IN_APP", english: saved, opened: viOpened, readOnly });
  const showVietnamese = language === "vi";
  // what the preview shows: the Vietnamese draft, or the English wording where a Vietnamese reader receives English
  const previewsVietnamese = showVietnamese && vietnamese.translatable;
  const shownTitle = previewsVietnamese ? vietnamese.shown.title : form.title;
  const shownSummary = previewsVietnamese ? vietnamese.shown.summary : form.summary;
  const { go, modal: leaveModal } = useLeaveGuard(
    dirty || vietnamese.dirty,
    isEmail ? tr("Edit Email Notification") : tr("Edit In-App Notification"),
    tr("another page"),
  );

  const languageTabs = (
    <TabNav
      tabs={[
        { id: "en", label: "English" },
        { id: "vi", label: "Tiếng Việt", dot: vietnamese.dirty, dotLabel: tr("Unsaved changes") },
      ]}
      activeTab={language}
      onChange={(id) => { setLanguage(id as "en" | "vi"); if (id === "vi") setViOpened(true); }}
      variant="pill"
      ariaLabel={tr("Wording language")}
      className="w-56"
    />
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
      showToast({ type: "error", title: tr("Cannot save"), message: issue });
      return;
    }
    // the Vietnamese wording is checked before anything is published, so that English is not published and Vietnamese then refused
    const translating = vietnamese.dirty || (language === "vi" && vietnamese.outdated);
    const translationIssue = translating ? vietnamese.problem(form) : null;
    if (translationIssue) {
      setTab("content");
      setLanguage("vi");
      showToast({ type: "error", title: tr("Cannot save"), message: translationIssue });
      return;
    }
    const englishPublished = isEmail ? dirtyEmail : dirtyInApp;
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
        await notificationPolicyApi.updateAppearance(eventCode, appearance.icon, once());
      }
      // last: it belongs to the English version that is now in use
      if (translating) {
        try {
          await vietnamese.publish(englishPublished);
        } catch (e) {
          showToast({ type: "error", title: tr("Vietnamese wording not saved"), message: getApiErrorMessage(e, "The wording could not be saved.") });
          if (dirty) await load();
          return;
        }
      }
      showToast({
        type: "success",
        title: "Saved",
        message: tr("The change is saved and recorded in the Audit Trail."),
      });
      await load();
    } catch (e) {
      if (isChangedByOthers(e)) setChangedByOthers(true);
      showToast({
        type: "error",
        title: isChangedByOthers(e)
          ? tr("Not saved: changed by someone else")
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
    const priority = delivery.priority.toLowerCase();
    const styles = getNotificationIconStyles(priority);
    showToast({
      type: priority === "high" || priority === "critical" ? "warning" : "info",
      title: fill(form.title, samples) || "Title",
      message: fill(form.summary, samples) || "Message",
      icon:
        resolveIcon(iconLibraries, appearance.icon) ??
        getNotificationTypeIcon(eventCode),
      iconClassName: `${styles.bg} ${styles.text}`,
      color: getNotificationPriorityHex(priority),
    });
  };

  const sendTest = async () => {
    setSendingTest(true);
    try {
      await notificationPolicyApi.testSend(eventCode, testTo.trim());
      showToast({
        type: "success",
        title: tr("Test email sent"),
        message: `The saved email was sent to ${testTo.trim()}.`,
      });
      setTesting(false);
    } catch (e) {
      showToast({
        type: "error",
        title: tr("Test email not sent"),
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
              ? tr("Email Notification Details")
              : tr("In-App Notification Details")
          }
          breadcrumbItems={breadcrumb(navigate, true, channel)}
          actions={
            <Button
              size="sm"
              variant="outline-emerald"
              onClick={() =>
                navigateBack(navigate, null, `${ROUTES.SETTINGS.NOTIFICATIONS}?tab=${isEmail ? "email" : "in-app"}`)
              }
            >
              {tr("Back")}
            </Button>
          }
        />
        <WarningBanner
          variant="error"
          title={tr("Unable to open this notification.")}
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
          title={tr("Email Notification Details")}
          breadcrumbItems={breadcrumb(navigate, true, channel)}
          actions={
            <Button
              size="sm"
              variant="outline-emerald"
              onClick={() =>
                navigateBack(navigate, null, `${ROUTES.SETTINGS.NOTIFICATIONS}?tab=email`)
              }
            >
              {tr("Back")}
            </Button>
          }
        />
        <WarningBanner
          variant="error"
          title={tr("This notification has no email.")}
          description={tr("It can only be sent in the application.")}
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
  // the colour of the icon follows the priority being chosen, so the preview changes as soon as the priority does
  const previewStyles = getNotificationIconStyles(delivery.priority);
  const title = isEmail
    ? canManage
      ? tr("Edit Email Notification")
      : tr("Email Notification Details")
    : canManage
      ? tr("Edit In-App Notification")
      : tr("In-App Notification Details");
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
        onClick={() => navigateBack(go, null, backPath)}
      >
        {tr("Back")}
      </Button>
      {!isEmail ? (
        <Button
          size="sm"
          variant="outline-emerald"
          onClick={showToastSample}
          title={tr("Show the toast of this notification with the wording and icon being edited")}
        >
          {tr("Test Notification")}
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
              ? tr("Send the saved email to an address")
              : tr("Write and save the email first")
          }
        >
          {tr("Send Test")}
        </Button>
      ) : null}
      {otherChannel ? (
        <Button
          size="sm"
          variant="outline-emerald"
          onClick={goToOther}
          title={
            isEmail
              ? tr("Open the in-app notification of this event")
              : tr("Open the email of this event")
          }
        >
          {isEmail ? tr("In-app Notification") : tr("Email Notification")}
        </Button>
      ) : null}

      {canManage ? (
        <>
          <Button
            size="sm"
            variant="outline-emerald"
            disabled={(!dirty && !vietnamese.dirty) || saving}
            onClick={() => {
              vietnamese.discard();
              setForm(saved);
              setAppearance(savedAppearance);
              setDelivery(savedDelivery);
            }}
          >
            {tr("Discard Changes")}
          </Button>
          <Button
            size="sm"
            variant="outline-emerald"
            className="whitespace-nowrap"
            disabled={(!dirty && !vietnamese.dirty && !(language === "vi" && vietnamese.outdated)) || saving}
            onClick={() => void save()}
          >
            {saving ? "Saving…" : "Save"}
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
              {tr("Reload")}
            </Button>
          </div>
        </WarningBanner>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <TabNav
          tabs={TABS}
          activeTab={tab}
          onChange={(id) => setTab(id as "content" | "delivery")}
          ariaLabel={__ariaTr("Notification sections")}
          layoutId="notification-event-tabs"
        />

        <div className="p-4 md:p-5">
          {tab === "content" ? (
            <>
              <div className="grid grid-cols-1 gap-4 md:gap-5 xl:grid-cols-2">
                <div className="flex min-w-0 flex-col gap-4 md:gap-5">
                  <FormSection
                    title={tr("Notification Information")}
                    icon={<IconInfoCircle className="h-4 w-4" />}
                    headerRight={
                      <Badge color={PRIORITY_COLOR[detail.priority] ?? "slate"} size="sm">
                        {priorityLabel(detail.priority)}
                      </Badge>
                    }
                  >
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <FormField label={tr("Event")}>
                        <ReadOnlyField value={tr(detail.name)} />
                      </FormField>
                      <FormField label={tr("Event Code")}>
                        <ReadOnlyField value={detail.eventCode} />
                      </FormField>
                      <FormField label={tr("Module")}>
                        <ReadOnlyField value={tr(moduleLabel(detail.module))} />
                      </FormField>
                      <FormField label={tr("Status")}>
                        <ReadOnlyField value={channelStatus} />
                      </FormField>
                      <FormField label={tr("Last Updated")}>
                        <ReadOnlyField
                          value={formatDateTime(detail.updatedAt)}
                        />
                      </FormField>
                      <FormField label={tr("Priority")}>
                        {readOnly ? (
                          <ReadOnlyField value={priorityLabel(detail.priority)} />
                        ) : (
                          <Select
                            value={delivery.priority}
                            onChange={(priority: string) => setDelivery({ ...delivery, priority })}
                            options={[...PRIORITY_CHOICES, ...(defaultPriority === "CRITICAL" ? (["CRITICAL"] as const) : [])].map((value) => ({ value, label: priorityLabel(value) }))}
                            aria-label={tr("Priority")}
                          />
                        )}
                      </FormField>
                      {detail.description ? (
                        <FormField
                          label={tr("Description")}
                          className="md:col-span-2"
                        >
                          <ReadOnlyField
                            value={detail.description}
                            className="h-auto min-h-9 py-2"
                          />
                        </FormField>
                      ) : null}
                    </div>
                    {!readOnly ? (
                      <p className="mt-1.5 text-xs text-slate-500">
                        {tr("Priority: how important this notification is. People see it on the Notifications page and can filter by it.")}
                        {delivery.priority === defaultPriority
                          ? ` ${trFormat("It is the default ({priority}).", { priority: tr(priorityLabel(defaultPriority)) })}`
                          : ` ${trFormat("The default is {priority}; choose it to go back.", { priority: tr(priorityLabel(defaultPriority)) })}`}{" "}
                        {tr("A change applies to notifications sent from now on.")}
                      </p>
                    ) : null}
                  </FormSection>

                  {!isEmail ? (
                    <>
                      <FormSection
                        className="flex-1"
                        title={tr("In-App Wording")}
                        icon={<IconPencilMinus className="h-4 w-4" />}
                        headerRight={languageTabs}
                      >
                        {showVietnamese ? vietnamese.editor : null}
                        <div className={showVietnamese ? "hidden" : "space-y-4"}>
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
                      title={tr("Email Wording")}
                      icon={<Mail className="h-4 w-4" />}
                      headerRight={languageTabs}
                    >
                      {showVietnamese ? vietnamese.editor : null}
                      <div className={showVietnamese ? "hidden" : "space-y-4"}>
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
                            placeholder={tr("Write the message of the email…")}
                          />
                        </FormField>
                        <FormField
                          label={FIELD_LABEL.label}
                          htmlFor="wf-label"
                          hint={tr("The button opens the same page as the in-app notification.")}
                        >
                          <TokenTextField
                            id="wf-label"
                            ref={refs.label}
                            ariaLabel={FIELD_LABEL.label}
                            value={form.label}
                            onChange={set("label")}
                            maxLength={80}
                            placeholder={tr("Open in EQMS")}
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
                    title={tr("Preview")}
                    icon={<Eye className="h-4 w-4" />}
                    headerRight={
                      isEmail ? (
                        <DeviceSwitch mobile={mobile} onChange={setMobile} />
                      ) : undefined
                    }
                  >
                    <div
                      aria-label={tr("Preview")}
                      className="space-y-4 rounded-xl bg-slate-100 p-3 sm:p-4"
                    >
                      {!isEmail ? (
                        <div className="mx-auto flex w-full max-w-md items-start gap-3 overflow-hidden rounded-xl border border-slate-200 bg-white p-3">
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${previewStyles.bg} ${previewStyles.text}`}
                          >
                            <ChosenIcon
                              icon={appearance.icon}
                              fallback={getNotificationTypeIcon(eventCode)}
                              className="h-4 w-4"
                            />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-slate-900 [overflow-wrap:anywhere]">
                              {fill(shownTitle, samples) || tr("Title")}
                            </p>
                            <p className="mt-0.5 whitespace-pre-line text-xs text-slate-600 [overflow-wrap:anywhere]">
                              {fill(shownSummary, samples) || tr("Message")}
                            </p>
                            <p className="mt-1 text-xs text-slate-400">
                              {tr("2 minutes ago")}
                            </p>
                          </div>
                          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                        </div>
                      ) : null}
                      {showVietnamese && !vietnamese.translatable ? (
                        <p className="text-xs text-slate-500">{tr("A Vietnamese reader receives the English wording shown here.")}</p>
                      ) : null}
                      {hasEmail ? (
                        <div className="space-y-2">
                          <p className="min-w-0 truncate text-xs text-slate-600">
                            <span className="font-semibold">
                              {tr("Email subject:")}
                            </span>{" "}
                            {(previewsVietnamese ? vietnamese.previewSubject : previewSubject) || "…"}
                          </p>
                          <EmailPreviewFrame
                            html={previewsVietnamese ? vietnamese.previewHtml : previewHtml}
                            mobile={mobile}
                          />
                        </div>
                      ) : null}
                    </div>
                  </FormSection>

                  {!isEmail ? (
                    <FormSection
                      className="flex-1"
                      title={tr("Notification Icon")}
                      icon={<Palette className="h-4 w-4" />}
                    >
                      <NotificationIconPicker
                        icon={appearance.icon}
                        fallback={getNotificationTypeIcon(eventCode)}
                        onChange={(icon) => setAppearance({ icon })}
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
                  ? tr("Whether the email is sent, to whom, and when. Every change is recorded in the Audit Trail.")
                  : tr("Whether the notification is shown, to whom, and when it escalates. Every change is recorded in the Audit Trail.")
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
      {tab === "content" && language === "en" && canManage ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <TabNav
            tabs={[
              {
                id: "placeholders",
                label: tr("Placeholders"),
                count: variables.length + others.length,
              },
            ]}
            activeTab="placeholders"
            onChange={() => undefined}
            ariaLabel={__ariaTr("Lists")}
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
        title={tr("Send a test email")}
        description={tr("The saved email is sent with example values, so you can see it in a real inbox. Nothing is recorded as a notification.")}
        confirmText="Send test"
        isLoading={sendingTest}
        confirmDisabled={
          !/^[^@\s<>"]+@[^@\s<>"]+\.[^@\s<>"]+$/.test(testTo.trim())
        }
        size="md"
      >
        <FormField label={tr("Send to")} htmlFor="test-to">
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
