import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, Palette, Upload } from "lucide-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { Select } from "@/components/ui/select/Select";
import { FormSection } from "@/components/ui/form/FormSection";
import { FormField, Input } from "@/components/ui/form/ResponsiveForm";
import { ColorPickerInput } from "@/components/ui/color-picker/ColorPickerInput";
import {
  DeviceSwitch,
  EmailPreviewFrame,
  SCROLL,
} from "./components/EmailPreviewFrame";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { FullPageLoading } from "@/components/ui/loading/Loading";
import { useToast } from "@/components/ui/toast/Toast";
import { usePermissions } from "@/hooks/usePermissions";
import { useDebounce } from "@/hooks";
import { emailDesign as breadcrumb } from "@/components/ui/breadcrumb/breadcrumbs/settings";
import { useLeaveGuard } from '@/hooks/useLeaveGuard';
import { CHANGED_BY_OTHERS_TEXT, CHANGED_BY_OTHERS_TITLE, isChangedByOthers } from './changedByOthers';
import { ROUTES } from "@/app/routes.constants";
import { formatDateTime } from "@/utils/format";
import { getApiErrorMessage } from "@/utils/apiError";
import {
  emailDesignApi,
  type EmailAlign,
  type EmailDesign,
  type EmailDesignInput,
} from "@/services/api/emailDesign";
import { IconBrush } from "@tabler/icons-react";
import { tr } from "@/i18n";

const MAX_LOGO_BYTES = 250 * 1024;
const COLOUR = /^#[0-9a-fA-F]{6}$/;
const COLOUR_FIELDS = [
  "brandColor",
  "buttonColor",
  "bodyColor",
  "footerColor",
  "headerTextColor",
  "bodyTextColor",
  "footerTextColor",
] as const;
/** The small heading of an area of the form, as the other configuration screens write it. */
const AREA = "text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2.5";
const SAME_FONT = "SAME";
/** The header needs a logo picture or a text; the design cannot be saved with neither. */
const headerMissing = (design: { logoUrl: string | null; logoText: string | null }) => !design.logoUrl && !design.logoText?.trim();

const toInput = (d: EmailDesign): EmailDesignInput => ({
  logoUrl: d.logoUrl,
  logoText: d.logoText,
  brandColor: d.brandColor,
  buttonColor: d.buttonColor,
  bodyColor: d.bodyColor,
  footerColor: d.footerColor,
  logoAlign: d.logoAlign,
  footerAlign: d.footerAlign,
  headerTextColor: d.headerTextColor,
  headerFontFamily: d.headerFontFamily,
  bodyTextColor: d.bodyTextColor,
  footerTextColor: d.footerTextColor,
  fontFamily: d.fontFamily,
  footerText: d.footerText,
  supportEmail: d.supportEmail,
});

const ALIGN_OPTIONS: { label: string; value: EmailAlign }[] = [
  { label: "Left", value: "LEFT" },
  { label: "Center", value: "CENTER" },
  { label: "Right", value: "RIGHT" },
];

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("The file could not be read."));
    reader.readAsDataURL(file);
  });

/** The one look every email of the system shares. Set once here; no message carries its own logo, colour or footer any more. */
export const EmailDesignView: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { hasPermissionAlias } = usePermissions();
  const canManage =
    hasPermissionAlias("settings.notification_policy.manage") ||
    hasPermissionAlias("settings.email_template.manage");
  const [design, setDesign] = useState<EmailDesign | null>(null);
  const [form, setForm] = useState<EmailDesignInput | null>(null);
  const [error, setError] = useState("");
  const [html, setHtml] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [mobile, setMobile] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      const d = await emailDesignApi.get();
      setDesign(d);
      setForm(toInput(d));
      setChangedByOthers(false);
      setError("");
    } catch (e) {
      setError(getApiErrorMessage(e, "The email design could not be loaded."));
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const key = useDebounce(JSON.stringify(form), 400);
  useEffect(() => {
    if (!form) return;
    const draft = JSON.parse(key) as EmailDesignInput;
    if (!COLOUR_FIELDS.every((field) => COLOUR.test(draft[field]))) return; // a colour half typed is not a mistake yet
    let live = true;
    emailDesignApi
      .preview(draft)
      .then((h) => {
        if (!live) return;
        setHtml(h);
        setPreviewError('');
      })
      .catch((e) => live && setPreviewError(getApiErrorMessage(e, 'The preview could not be made.')));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const set = <K extends keyof EmailDesignInput>(
    name: K,
    value: EmailDesignInput[K],
  ) => setForm((prev) => (prev ? { ...prev, [name]: value } : prev));
  const [changedByOthers, setChangedByOthers] = useState(false);
  const dirty =
    design && form && JSON.stringify(toInput(design)) !== JSON.stringify(form);
  const { go, modal: leaveModal } = useLeaveGuard(Boolean(dirty), 'Email Design');
  // no message is shown for it: Save stays closed until there is a text or a logo
  const logoError = !!form && headerMissing(form);
  const colourOk = form
    ? COLOUR_FIELDS.every((field) => COLOUR.test(form[field]))
    : false;

  const pickLogo = async (file: File | undefined) => {
    if (!file) return;
    if (!/^image\/(png|jpeg|gif)$/.test(file.type)) {
      showToast({
        type: "error",
        title: tr("Logo not accepted"),
        message: tr("Use a PNG, JPEG or GIF picture."),
      });
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      showToast({
        type: "error",
        title: tr("Logo too large"),
        message: tr("Use a picture under 250 KB."),
      });
      return;
    }
    set("logoUrl", await readAsDataUrl(file));
  };

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const saved = await emailDesignApi.update(
        {
          ...form,
          logoUrl: form.logoUrl || null,
          footerText: form.footerText || null,
          supportEmail: form.supportEmail || null,
        },
        design?.version,
      );
      setChangedByOthers(false);
      setDesign(saved);
      setForm(toInput(saved));
      showToast({
        type: "success",
        title: "Saved",
        message: `The email design is now version ${saved.version}. Every email uses it.`,
      });
    } catch (e) {
      if (isChangedByOthers(e)) setChangedByOthers(true);
      showToast({
        type: "error",
        title: isChangedByOthers(e) ? tr("Not saved: changed by someone else") : "Not saved",
        message: getApiErrorMessage(e, "The email design could not be saved."),
      });
    } finally {
      setSaving(false);
    }
  };

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader
          title={tr("Email Design")}
          breadcrumbItems={breadcrumb(navigate)}
          actions={
            <Button
              size="sm"
              variant="outline-emerald"
              onClick={() => go(ROUTES.SETTINGS.NOTIFICATIONS)}
            >
              {tr("Back")}
            </Button>
          }
        />
        <WarningBanner
          variant="error"
          title={tr("Unable to open the email design.")}
          description={error}
        />
      </div>
    );
  }
  if (!design || !form) return <FullPageLoading text={tr("Loading email design…")} />;

  const colour = (
    label: string,
    field: (typeof COLOUR_FIELDS)[number],
  ) => (
    // the picker puts 4px between its label and its box, the other fields 6px: the same gap here keeps the boxes of a row level
    <div className="[&>div:first-child]:gap-1.5">
      <ColorPickerInput
        label={tr(label)}
        value={form[field]}
        disabled={!canManage}
        onChange={(value) => set(field, value)}
      />
    </div>
  );

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <PageHeader
        title={tr("Email Design")}
        breadcrumbItems={breadcrumb(navigate)}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline-emerald"
              onClick={() => go(ROUTES.SETTINGS.NOTIFICATIONS)}
            >
              {tr("Back")}
            </Button>
            {canManage ? (
              <Button
                size="sm"
                variant="outline-emerald"
                className="whitespace-nowrap"
                disabled={!dirty || !colourOk || !!logoError || saving}
                onClick={() => void save()}
              >
                {saving ? "Saving…" : "Save"}
              </Button>
            ) : null}
          </div>
        }
      />

      {changedByOthers ? (
        <WarningBanner variant="warning" title={CHANGED_BY_OTHERS_TITLE} description={CHANGED_BY_OTHERS_TEXT}>
          <div className="mt-3">
            <Button size="sm" variant="outline-emerald" onClick={() => void load()}>{tr("Reload")}</Button>
          </div>
        </WarningBanner>
      ) : null}
      <div className="grid grid-cols-1 gap-4 md:gap-5 xl:grid-cols-2">
        <div className="min-w-0 self-start">
          <FormSection title={tr("Email Design")} icon={<IconBrush className="h-4 w-4" />}>
            <div className="space-y-5">
              <div>
                <p className={AREA}>{tr("Header")}</p>
                <div className="space-y-4">
              <FormField
                label={tr("Logo")}
                htmlFor="ed-logo"
                hint={tr("Type the text of the header, or upload a logo (PNG, JPEG or GIF under 250 KB).")}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <div className="min-w-[14rem] flex-1">
                    <Input
                      id="ed-logo"
                      value={form.logoText ?? ""}
                      maxLength={200}
                      disabled={!canManage || !!form.logoUrl}
                      onChange={(e) => set("logoText", e.target.value || null)}
                      placeholder={
                        form.logoUrl
                          ? tr("A logo is uploaded (remove it to type a text)")
                          : tr("The text of the header, for example the name of your company")
                      }
                    />
                  </div>
                  {canManage ? (
                    <>
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/png,image/jpeg,image/gif"
                        aria-label={tr("Logo file")}
                        className="sr-only"
                        onChange={(e) => void pickLogo(e.target.files?.[0])}
                      />
                      <Button
                        size="sm"
                        variant="outline-emerald"
                        onClick={() => fileRef.current?.click()}
                      >
                        <Upload className="mr-1.5 h-3.5 w-3.5" />
                        {tr("Upload logo")}
                      </Button>
                      {form.logoUrl ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => set("logoUrl", null)}
                        >
                          {tr("Remove")}
                        </Button>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </FormField>
                  <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
                    <Select
                      label={tr("Logo alignment")}
                      value={form.logoAlign}
                      disabled={!canManage}
                      enableSearch={false}
                      onChange={(value: EmailAlign) => set("logoAlign", value)}
                      options={ALIGN_OPTIONS}
                    />
                    {colour("Header Colour", "brandColor")}
                  </div>
                  {/* the colour and the font are of the words, so they are offered only once there are words */}
                  {form.logoText?.trim() ? (
                  <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
                    {colour("Header Text Colour", "headerTextColor")}
                    <div>
                      <Select
                        label={tr("Header font")}
                        value={form.headerFontFamily || SAME_FONT}
                        disabled={!canManage}
                        enableSearch={false}
                        onChange={(value: string) => set("headerFontFamily", value === SAME_FONT ? null : value)}
                        options={[{ label: tr("Same as body"), value: SAME_FONT }, ...design.fonts.map((font) => ({ label: font, value: font }))]}
                      />
                      <p className="mt-1 text-2xs text-slate-500 sm:text-xs">{tr("The font of the words in the header.")}</p>
                    </div>
                  </div>
                  ) : null}
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <p className={AREA}>{tr("Body")}</p>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
                    {colour("Body Colour", "bodyColor")}
                    {colour("Body Text Colour", "bodyTextColor")}
                  </div>
                  <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
                    {colour("Button Colour", "buttonColor")}
                    <div>
                      <Select
                        label={tr("Font")}
                        value={form.fontFamily}
                        disabled={!canManage}
                        onChange={(value) => set("fontFamily", value)}
                        options={design.fonts.map((font) => ({ label: font, value: font }))}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <p className={AREA}>{tr("Footer")}</p>
                <div className="space-y-4">
                  <FormField label={tr("Footer line")} htmlFor="ed-footer" hint={tr("{year} becomes the current year.")}>
                    <Input
                      id="ed-footer"
                      value={form.footerText ?? ""}
                      maxLength={500}
                      disabled={!canManage}
                      onChange={(e) => set("footerText", e.target.value)}
                      placeholder={tr("© {year} Company. This is an automatic message.")}
                    />
                  </FormField>
                  <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
                    <FormField label={tr("Support e-mail")} htmlFor="ed-support">
                      <Input
                        id="ed-support"
                        type="email"
                        value={form.supportEmail ?? ""}
                        disabled={!canManage}
                        onChange={(e) => set("supportEmail", e.target.value)}
                        placeholder="qa@company.example"
                      />
                    </FormField>
                    <Select
                      label={tr("Footer alignment")}
                      value={form.footerAlign}
                      disabled={!canManage}
                      enableSearch={false}
                      onChange={(value: EmailAlign) => set("footerAlign", value)}
                      options={ALIGN_OPTIONS}
                    />
                  </div>
                  <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
                    {colour("Footer Colour", "footerColor")}
                    {colour("Footer Text Colour", "footerTextColor")}
                  </div>
                </div>
              </div>
            </div>
          </FormSection>
        </div>
        {/* on a wide screen the preview stays in view while the form scrolls; taller than the screen, it scrolls on its own */}
        <div className={`min-w-0 self-start xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto ${SCROLL}`}>
          <FormSection
            title={tr("Preview")}
            icon={<Eye className="h-4 w-4" />}
            headerRight={<DeviceSwitch mobile={mobile} onChange={setMobile} />}
          >
            <div aria-label={tr("Preview")}>
              {previewError ? <p role="alert" className="mb-2 text-xs text-red-600">{previewError}</p> : null}
              <EmailPreviewFrame html={html} mobile={mobile} height={400} />
            </div>
          </FormSection>
        </div>
      </div>
      {leaveModal}
    </div>
  );
};
