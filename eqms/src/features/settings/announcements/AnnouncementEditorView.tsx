import React, { useEffect, useId, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button/Button";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { FormSection } from "@/components/ui/form/FormSection";
import { cn } from "@/components/ui/utils";
import { Select } from "@/components/ui/select/Select";
import { Switch } from "@/components/ui/switch/Switch";
import { DateTimePicker } from "@/components/ui/datetime-picker/DateTimePicker";
import {
  AnnouncementDialogContent,
  AnnouncementModal,
  type AnnouncementSeverity,
} from "@/components/ui/announcement-modal";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { useToast } from "@/components/ui/toast/Toast";
import { announcementApi } from "@/services/api/announcements";
import { getApiErrorMessage } from "@/utils/apiError";
import { ROUTES } from "@/app/routes.constants";
import {
  systemAnnouncementCreate,
  systemAnnouncementEdit,
} from "@/components/ui/breadcrumb/breadcrumbs/settings";
import {
  defaultFormValues,
  fromPickerValue,
  toPickerValue,
  validateAnnouncementForm,
  type AnnouncementFormErrors,
  type AnnouncementFormValues,
} from "./announcementForm";
import { MESSAGE_MAX, TITLE_MAX } from "./types";
import { IconEye, IconSpeakerphone } from "@tabler/icons-react";
import { displayDateTime } from "@/utils/format";

/** The label, control and hint/error used by the other forms: 12/14px label, 14px control, 12px hint. */
const CONTROL =
  "w-full rounded-lg border px-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-1";
const controlTone = (invalid: boolean) =>
  invalid
    ? "border-red-300 focus:border-red-500 focus:ring-red-500"
    : "border-slate-200 focus:border-emerald-500 focus:ring-emerald-500";

const Field: React.FC<{
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: (props: {
    id: string;
    "aria-describedby"?: string;
    "aria-invalid"?: boolean;
  }) => React.ReactNode;
}> = ({ label, required, error, hint, children }) => {
  const id = useId();
  const noteId = error || hint ? `${id}-note` : undefined;
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-xs font-medium text-slate-700 sm:text-sm"
      >
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      {children({
        id,
        "aria-describedby": noteId,
        ...(error ? { "aria-invalid": true } : {}),
      })}
      {error ? (
        <p id={noteId} className="mt-1 text-2xs text-red-600 sm:text-xs">
          {error}
        </p>
      ) : (
        hint && (
          <p id={noteId} className="mt-1 text-2xs text-slate-500 sm:text-xs">
            {hint}
          </p>
        )
      )}
    </div>
  );
};

const SEVERITY_OPTIONS: { label: string; value: AnnouncementSeverity }[] = [
  { label: "Information", value: "INFO" },
  { label: "Warning", value: "WARNING" },
  { label: "Critical", value: "CRITICAL" },
];

/**
 * Create or edit a system announcement. The preview on the right is the same banner users see after signing in, with its
 * Close button, and follows what is typed.
 */
export const AnnouncementEditorView: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { id } = useParams<{ id: string }>();
  const creating = !id;
  const [values, setValues] = useState<AnnouncementFormValues>(() =>
    defaultFormValues(),
  );
  const [version, setVersion] = useState<number | undefined>();
  const [errors, setErrors] = useState<AnnouncementFormErrors>({});
  const [loading, setLoading] = useState(!creating);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (!id) return undefined;
    let alive = true;
    setLoading(true);
    announcementApi
      .get(id)
      .then((a) => {
        if (!alive) return;
        setValues({
          title: a.title,
          message: a.message,
          severity: a.severity,
          startsAt: toPickerValue(a.startsAt),
          endsAt: toPickerValue(a.endsAt),
          enabled: a.enabled,
        });
        setVersion(a.version);
      })
      .catch((error) => {
        if (alive)
          setLoadError(
            getApiErrorMessage(error, "Unable to load this announcement."),
          );
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [id]);

  const set = <K extends keyof AnnouncementFormValues>(
    key: K,
    value: AnnouncementFormValues[K],
  ) => {
    setValues((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: undefined }));
  };

  const back = () => navigate(ROUTES.SETTINGS.ANNOUNCEMENTS);
  const breadcrumbs = useMemo(
    () =>
      creating
        ? systemAnnouncementCreate(navigate)
        : systemAnnouncementEdit(navigate),
    [creating, navigate],
  );

  const save = async () => {
    const found = validateAnnouncementForm(values, creating);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const start = fromPickerValue(values.startsAt);
    const end = fromPickerValue(values.endsAt);
    if (!start || !end) return;
    const payload = {
      title: values.title.trim(),
      message: values.message.trim(),
      severity: values.severity,
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      enabled: values.enabled,
      version,
    };
    setSaving(true);
    try {
      if (id) await announcementApi.update(id, payload);
      else await announcementApi.create(payload);
      showToast({
        type: "success",
        title: "Announcement saved",
        message: values.enabled
          ? "It is shown to users during its period."
          : "It is saved switched off.",
      });
      back();
    } catch (error) {
      const conflict =
        (error as { response?: { status?: number } })?.response?.status === 409;
      showToast({
        type: "error",
        title: "Unable to save",
        message: conflict
          ? "Someone else changed this announcement. Reload it and make your change again."
          : getApiErrorMessage(error, "The announcement could not be saved."),
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <SectionLoading text="Loading announcement…" />;
  if (loadError) {
    return (
      <div className="space-y-4">
        <PageHeader title="Edit Announcement" breadcrumbItems={breadcrumbs} />
        <WarningBanner variant="error" description={loadError} />
      </div>
    );
  }

  const previewTitle = values.title.trim() || "Title of the announcement";
  const previewMessage = values.message.trim() || "The message appears here.";
  const start = fromPickerValue(values.startsAt);
  const end = fromPickerValue(values.endsAt);
  const period =
    start && end
      ? `Shown from ${displayDateTime(start)} until ${displayDateTime(end)}${values.enabled ? "" : " (switched off)"}.`
      : undefined;

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <PageHeader
        title={creating ? "New Announcement" : "Edit Announcement"}
        breadcrumbItems={breadcrumbs}
        actions={
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline-emerald"
              onClick={back}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="outline-emerald"
              onClick={save}
              disabled={saving}
              className="whitespace-nowrap"
            >
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:gap-5 xl:grid-cols-2">
        <div className="min-w-0 self-start">
          <FormSection
            title="Announcement Information"
            icon={<IconSpeakerphone className="h-4 w-4" />}
          >
            <div className="space-y-4">
              <Field
                label="Title"
                required
                error={errors.title}
                hint={`${values.title.length}/${TITLE_MAX}`}
              >
                {(props) => (
                  <input
                    {...props}
                    type="text"
                    value={values.title}
                    maxLength={TITLE_MAX}
                    onChange={(event) => set("title", event.target.value)}
                    placeholder="Planned maintenance tonight"
                    className={cn(CONTROL, "h-9", controlTone(!!errors.title))}
                  />
                )}
              </Field>
              <Field
                label="Message"
                required
                error={errors.message}
                hint={`${values.message.length}/${MESSAGE_MAX}. Plain text; line breaks are kept.`}
              >
                {(props) => (
                  <textarea
                    {...props}
                    rows={6}
                    maxLength={MESSAGE_MAX}
                    value={values.message}
                    onChange={(event) => set("message", event.target.value)}
                    placeholder="The system will be unavailable from 22:00 to 23:30. Please save your work before then."
                    className={cn(
                      CONTROL,
                      "resize-none py-2",
                      controlTone(!!errors.message),
                    )}
                  />
                )}
              </Field>
              <Select
                label="Severity"
                value={values.severity}
                onChange={(value: AnnouncementSeverity) =>
                  set("severity", value)
                }
                options={SEVERITY_OPTIONS}
              />
              <div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <DateTimePicker
                    label="Starts"
                    showTime
                    value={values.startsAt}
                    onChange={(value) => set("startsAt", value)}
                    error={errors.startsAt}
                  />
                  <DateTimePicker
                    label="Ends"
                    showTime
                    value={values.endsAt}
                    onChange={(value) => set("endsAt", value)}
                    error={errors.endsAt}
                  />
                </div>
                <p className="mt-1.5 text-2xs text-slate-500 sm:text-xs">
                  Times are in your browser's time zone.
                </p>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <div className="min-w-0">
                  <span className="text-xs font-medium text-slate-700 sm:text-sm">
                    Switched on
                  </span>
                  <p className="mt-0.5 text-2xs text-slate-500 sm:text-xs">
                    When turned off, notifications are saved but not displayed
                    to the user.
                  </p>
                </div>
                <Switch
                  size="sm"
                  checked={values.enabled}
                  onChange={(enabled) => set("enabled", enabled)}
                />
              </div>
            </div>
          </FormSection>
        </div>

        <div className="min-w-0 self-start">
          <FormSection
            title="Preview"
            icon={<IconEye className="h-4 w-4" />}
          >
            <div
              data-testid="announcement-preview"
              className="rounded-xl bg-slate-100 p-4 sm:p-6"
            >
              <AnnouncementDialogContent
                className="mx-auto max-w-md"
                title={previewTitle}
                message={previewMessage}
                severity={values.severity}
                footnote={period}
                onClose={() => undefined}
              />
            </div>
            <div className="mt-4 flex justify-end">
              <Button
                size="sm"
                variant="outline-emerald"
                onClick={() => setPreviewOpen(true)}
              >
                Preview full screen
              </Button>
            </div>
          </FormSection>
        </div>
      </div>
      <AnnouncementModal
        open={previewOpen}
        title={previewTitle}
        message={previewMessage}
        severity={values.severity}
        footnote={period}
        onClose={() => setPreviewOpen(false)}
      />
    </div>
  );
};
