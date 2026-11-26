import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Eye } from "lucide-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { Select } from "@/components/ui/select/Select";
import { FormSection } from "@/components/ui/form/FormSection";
import { FormField, Input } from "@/components/ui/form/ResponsiveForm";
import { ColorPickerInput } from "@/components/ui/color-picker/ColorPickerInput";
import { Slider } from "@/components/ui/slider";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { FullPageLoading } from "@/components/ui/loading/Loading";
import { toastShadowCss, useToast } from "@/components/ui/toast/Toast";
import { usePermissions } from "@/hooks/usePermissions";
import { inAppDesign as breadcrumb } from "@/components/ui/breadcrumb/breadcrumbs/settings";
import { useLeaveGuard } from "@/hooks/useLeaveGuard";
import {
  CHANGED_BY_OTHERS_TEXT,
  CHANGED_BY_OTHERS_TITLE,
  isChangedByOthers,
} from "./changedByOthers";
import { ROUTES } from "@/app/routes.constants";
import { getApiErrorMessage } from "@/utils/apiError";
import { contrastRatio, withContrast } from "@/utils/contrast";
import {
  inAppDesignApi,
  type InAppDesign,
  type InAppDesignInput,
  type ToastPlace,
} from "@/services/api/inAppDesign";
import { IconBrush } from "@tabler/icons-react";
import { tr, trFormat } from "@/i18n";

const COLOUR = /^#[0-9a-fA-F]{6}$/;
/** The small heading of an area of the form, as the other configuration screens write it. */
const AREA =
  "text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2.5";
/** The least contrast the Web Content Accessibility Guidelines ask of a part of a screen that must be seen (a border, an icon). */
const MIN_CONTRAST = 3;
/** The slider counts tenths of the ratio: 1.1:1 to 12:1. */
const CONTRAST_SLIDER_MIN = 11;
const CONTRAST_SLIDER_MAX = 120;
const MIN_SECONDS = 2;
const MAX_SECONDS = 60;

const POSITION_OPTIONS: { label: string; value: ToastPlace }[] = [
  { label: "Top Right", value: "top-right" },
  { label: "Top Left", value: "top-left" },
  { label: tr("Top Center"), value: "top-center" },
  { label: "Center", value: "center" },
  { label: tr("Bottom Right"), value: "bottom-right" },
  { label: tr("Bottom Left"), value: "bottom-left" },
  { label: tr("Bottom Center"), value: "bottom-center" },
];

const toInput = (d: InAppDesign): InAppDesignInput => ({
  toastPosition: d.toastPosition,
  toastDurationSeconds: d.toastDurationSeconds,
  toastColor: d.toastColor,
  toastShadow: d.toastShadow,
});

/** The one look every toast of the application shares. Set once here, like the Email Design; a toast takes it from the system, not from the screen that shows it. */
export const InAppDesignView: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { hasPermissionAlias } = usePermissions();
  const canManage =
    hasPermissionAlias("settings.notification_policy.manage");
  const [design, setDesign] = useState<InAppDesign | null>(null);
  const [form, setForm] = useState<InAppDesignInput | null>(null);
  // the display time is typed: it is text until it is a whole number
  const [seconds, setSeconds] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [changedByOthers, setChangedByOthers] = useState(false);

  const load = async () => {
    try {
      const d = await inAppDesignApi.get();
      setDesign(d);
      setForm(toInput(d));
      setSeconds(String(d.toastDurationSeconds));
      setChangedByOthers(false);
      setError("");
    } catch (e) {
      setError(
        getApiErrorMessage(
          e,
          "The in-app notification design could not be loaded.",
        ),
      );
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const set = <K extends keyof InAppDesignInput>(
    name: K,
    value: InAppDesignInput[K],
  ) => setForm((prev) => (prev ? { ...prev, [name]: value } : prev));
  const dirty =
    design && form && JSON.stringify(toInput(design)) !== JSON.stringify(form);
  const { go, modal: leaveModal } = useLeaveGuard(
    Boolean(dirty),
    "In-App Notification Design",
  );
  const secondsOk =
    /^\d{1,2}$/.test(seconds) &&
    Number(seconds) >= MIN_SECONDS &&
    Number(seconds) <= MAX_SECONDS;
  const colourOk = form ? COLOUR.test(form.toastColor) : false;

  const changeSeconds = (text: string) => {
    const digits = text.replace(/\D/g, "").slice(0, 2);
    setSeconds(digits);
    if (
      /^\d{1,2}$/.test(digits) &&
      Number(digits) >= MIN_SECONDS &&
      Number(digits) <= MAX_SECONDS
    )
      set("toastDurationSeconds", Number(digits));
  };

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const saved = await inAppDesignApi.update(form, design?.version);
      setChangedByOthers(false);
      setDesign(saved);
      setForm(toInput(saved));
      setSeconds(String(saved.toastDurationSeconds));
      showToast({
        type: "success",
        title: "Saved",
        message: `The in-app notification design is now version ${saved.version}. Every signed-in user gets it.`,
      });
    } catch (e) {
      if (isChangedByOthers(e)) setChangedByOthers(true);
      showToast({
        type: "error",
        title: isChangedByOthers(e)
          ? tr("Not saved: changed by someone else")
          : "Not saved",
        message: getApiErrorMessage(
          e,
          "The in-app notification design could not be saved.",
        ),
      });
    } finally {
      setSaving(false);
    }
  };

  // the toast as it will look with the colour, the shadow, the place and the time on the screen now, saved or not
  const testToast = () => {
    if (!form || !colourOk) return;
    const time = secondsOk ? Number(seconds) : form.toastDurationSeconds;
    showToast({
      type: "info",
      title: tr("Test notification"),
      message: trFormat("This is how a system message looks: this colour, this place, {seconds} seconds.", { seconds: time }),
      color: form.toastColor,
      shadow: form.toastShadow,
      position: form.toastPosition,
      duration: time * 1000,
    });
  };

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader
          title={tr("In-App Notification Design")}
          breadcrumbItems={breadcrumb(navigate)}
          actions={
            <Button
              size="sm"
              variant="outline-emerald"
              onClick={() => go(`${ROUTES.SETTINGS.NOTIFICATIONS}?tab=in-app`)}
            >
              {tr("Back")}
            </Button>
          }
        />
        <WarningBanner
          variant="error"
          title={tr("Unable to open the in-app notification design.")}
          description={error}
        />
      </div>
    );
  }
  if (!design || !form)
    return <FullPageLoading text="Loading in-app notification design…" />;

  const contrast = colourOk ? contrastRatio(form.toastColor, "#FFFFFF") : 1;
  const colour = colourOk ? form.toastColor : design.toastColor;

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <PageHeader
        title={tr("In-App Notification Design")}
        breadcrumbItems={breadcrumb(navigate)}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline-emerald"
              onClick={() => go(`${ROUTES.SETTINGS.NOTIFICATIONS}?tab=in-app`)}
            >
              {tr("Back")}
            </Button>
            <Button
              size="sm"
              variant="outline-emerald"
              onClick={testToast}
              disabled={!colourOk}
              title={tr("Show the toast with the colour, shadow, place and display time being edited")}
            >
              {tr("Test Toast")}
            </Button>
            {canManage ? (
              <Button
                size="sm"
                variant="outline-emerald"
                className="whitespace-nowrap"
                disabled={!dirty || !colourOk || !secondsOk || saving}
                onClick={() => void save()}
              >
                {saving ? "Saving…" : "Save"}
              </Button>
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

      <div className="grid grid-cols-1 gap-4 md:gap-5 xl:grid-cols-2">
        <div className="min-w-0 self-start">
          <FormSection
            title={tr("In-App Notification Design")}
            icon={<IconBrush className="h-4 w-4" />}
            description={tr("The toast: the message that pops up on screen. Applies to every signed-in user after Save.")}
          >
            <div className="space-y-5">
              <div>
                <p className={AREA}>{tr("Look")}</p>
                <div className="space-y-4">
                  <div className="max-w-xs">
                    <ColorPickerInput
                      label={tr("Toast Colour")}
                      value={form.toastColor}
                      disabled={!canManage}
                      onChange={(value) => set("toastColor", value)}
                    />
                  </div>
                  <p className="-mt-2 text-xs text-slate-500">
                    {tr("The border and the time bar of every system message, whatever its kind.")}
                  </p>
                  <div>
                    <div className="flex items-center justify-between text-xs font-medium text-slate-700 sm:text-sm">
                      <span>{tr("Contrast")}</span>
                      <span
                        aria-label={tr("Contrast of the toast colour")}
                        className={
                          contrast >= MIN_CONTRAST
                            ? "text-emerald-700"
                            : "text-amber-700"
                        }
                      >
                        {contrast.toFixed(1)}:1 —{" "}
                        {contrast >= MIN_CONTRAST
                          ? tr("easy to see")
                          : trFormat("faint, {min}:1 or more is recommended", { min: MIN_CONTRAST })}
                      </span>
                    </div>
                    <Slider
                      label={tr("Toast colour contrast")}
                      min={CONTRAST_SLIDER_MIN}
                      max={CONTRAST_SLIDER_MAX}
                      value={Math.min(
                        CONTRAST_SLIDER_MAX,
                        Math.max(
                          CONTRAST_SLIDER_MIN,
                          Math.round(contrast * 10),
                        ),
                      )}
                      onChange={(tenths) => {
                        if (canManage && colourOk)
                          set(
                            "toastColor",
                            withContrast(
                              form.toastColor,
                              "#FFFFFF",
                              tenths / 10,
                            ),
                          );
                      }}
                    />
                    <p className="text-xs text-slate-500">
                      {tr("Move it to make the colour lighter (left) or stronger (right); its hue stays the same.")}
                    </p>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs font-medium text-slate-700 sm:text-sm">
                      <span>{tr("Shadow")}</span>
                      <span>
                        {form.toastShadow === 0
                          ? "None"
                          : `${form.toastShadow}%`}
                      </span>
                    </div>
                    <Slider
                      label={tr("Toast shadow")}
                      min={0}
                      max={100}
                      value={form.toastShadow}
                      onChange={(strength) =>
                        canManage && set("toastShadow", strength)
                      }
                    />
                    <p className="text-xs text-slate-500">
                      {tr("From no shadow (left) to a deep one (right).")}
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <p className={AREA}>{tr("Place and time")}</p>
                <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
                  <div>
                    <Select
                      label={tr("Toast Position")}
                      value={form.toastPosition}
                      disabled={!canManage}
                      enableSearch={false}
                      onChange={(value: ToastPlace) =>
                        set("toastPosition", value)
                      }
                      options={POSITION_OPTIONS}
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      {tr("Where system messages pop up on screen.")}
                    </p>
                  </div>
                  <FormField
                    label={tr("Toast Display Time (Seconds)")}
                    htmlFor="iad-seconds"
                    hint={trFormat("How long a system message stays on screen before it goes away ({min} to {max}).", { min: MIN_SECONDS, max: MAX_SECONDS })}
                    error={
                      secondsOk
                        ? undefined
                        : trFormat("Enter a whole number from {min} to {max}.", { min: MIN_SECONDS, max: MAX_SECONDS })
                    }
                  >
                    <Input
                      id="iad-seconds"
                      type="text"
                      inputMode="numeric"
                      maxLength={2}
                      value={seconds}
                      disabled={!canManage}
                      aria-label={tr("Toast display time in seconds")}
                      onChange={(e) => changeSeconds(e.target.value)}
                    />
                  </FormField>
                </div>
              </div>
            </div>
          </FormSection>
        </div>

        {/* on a wide screen the preview stays in view while the form scrolls */}
        <div className="min-w-0 self-start xl:sticky xl:top-4">
          <FormSection title={tr("Preview")} icon={<Eye className="h-4 w-4" />}>
            <div
              aria-label={tr("Toast preview")}
              className="rounded-xl bg-slate-100 px-4 pb-8 pt-6"
            >
              <div
                className="relative mx-auto w-full max-w-sm overflow-hidden rounded-xl border bg-white/95"
                style={{
                  borderColor: colour,
                  boxShadow: toastShadowCss(form.toastShadow),
                }}
              >
                <div className="flex items-center gap-3 px-3 py-2.5">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${colour}1A`, color: colour }}
                  >
                    <Bell className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">
                      {tr("Test notification")}
                    </p>
                    <p className="text-[13px] font-medium text-slate-600">
                      {tr("This is how a system message looks.")}
                    </p>
                  </div>
                </div>
                <div
                  className="absolute bottom-0 left-0 h-[2px] w-2/3"
                  style={{ backgroundColor: colour }}
                />
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              {tr("Test Toast shows the real toast with this colour, shadow, place and display time, saved or not. A toast that carries the colours of a notification icon keeps its icon tile.")}
            </p>
          </FormSection>
        </div>
      </div>
      {leaveModal}
    </div>
  );
};
