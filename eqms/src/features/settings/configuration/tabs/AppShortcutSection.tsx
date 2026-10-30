import React, { useRef } from "react";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button/Button";
import { ColorPickerInput } from "@/components/ui/color-picker/ColorPickerInput";
import { useToast } from "@/components/ui/toast/Toast";
import type { GeneralConfig } from "../types";

export const APP_ICON_MIN_SIDE = 512;
export const APP_ICON_MAX_BYTES = 3 * 1024 * 1024;
export const APP_SHORT_NAME_MAX = 64;
const DEFAULT_BACKGROUND = "#FFFFFF";
const BUILT_IN_ICON = "/icons/apple-touch-icon.png";

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const measure = (dataUrl: string) =>
  new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () =>
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () =>
      reject(new Error("The file could not be read as an image."));
    image.src = dataUrl;
  });

/** What is wrong with a picture meant as a phone icon, or null when it is fine. The server checks the same things again. */
export const appIconProblem = (
  file: { type: string; size: number },
  size?: { width: number; height: number },
): string | null => {
  if (file.type !== "image/png" && file.type !== "image/jpeg")
    return "Use a PNG or JPEG image.";
  if (file.size > APP_ICON_MAX_BYTES)
    return `The icon must be smaller than ${Math.round(APP_ICON_MAX_BYTES / 1024 / 1024)} MB.`;
  if (size) {
    if (size.width < APP_ICON_MIN_SIDE || size.height < APP_ICON_MIN_SIDE)
      return `The icon must be at least ${APP_ICON_MIN_SIDE} x ${APP_ICON_MIN_SIDE} pixels (this one is ${size.width} x ${size.height}).`;
    if (
      Math.max(size.width, size.height) >
      2 * Math.min(size.width, size.height)
    )
      return "The icon must be roughly square.";
  }
  return null;
};

/** How the picture will look as a tile: the picture on the chosen colour, the way the server draws it. */
const Tile: React.FC<{
  src: string;
  background: string;
  label: string;
  shape: "ios" | "android";
  caption: string;
}> = ({ src, background, label, shape, caption }) => (
  <figure className="flex w-20 flex-col items-center gap-1.5">
    <div
      className={`flex h-16 w-16 items-center justify-center overflow-hidden shadow-md ring-1 ring-black/10 ${shape === "ios" ? "rounded-[22%]" : "rounded-full"}`}
      style={{ backgroundColor: background }}
    >
      <img
        src={src}
        alt=""
        className="object-contain"
        style={{
          width: shape === "ios" ? "90%" : "60%",
          height: shape === "ios" ? "90%" : "60%",
        }}
      />
    </div>
    <figcaption className="w-full truncate text-center text-2xs font-medium text-white drop-shadow">
      {label}
    </figcaption>
    <span className="text-2xs text-white/70">{caption}</span>
  </figure>
);

interface AppShortcutSectionProps {
  config: GeneralConfig;
  onChange: (config: GeneralConfig) => void;
}

/** Configuration > General: the icon and label of the shortcut people put on the home screen of a phone. */
export const AppShortcutSection: React.FC<AppShortcutSectionProps> = ({
  config,
  onChange,
}) => {
  const { showToast } = useToast();
  const input = useRef<HTMLInputElement>(null);
  const icon = config.appIcon ?? "";
  const background = /^#[0-9a-fA-F]{6}$/.test(config.appIconBackground ?? "")
    ? (config.appIconBackground as string)
    : DEFAULT_BACKGROUND;
  const label = (
    (config.appShortName ?? "").trim() ||
    config.systemDisplayName ||
    "EQMS"
  ).slice(0, APP_SHORT_NAME_MAX);
  const shown = icon || BUILT_IN_ICON;

  const pick = async (file: File | undefined) => {
    if (!file) return;
    const early = appIconProblem(file);
    if (early) {
      showToast({ type: "error", title: "Invalid icon", message: early });
      return;
    }
    try {
      const dataUrl = await readAsDataUrl(file);
      const problem = appIconProblem(file, await measure(dataUrl));
      if (problem) {
        showToast({ type: "error", title: "Invalid icon", message: problem });
        return;
      }
      onChange({ ...config, appIcon: dataUrl });
    } catch (error) {
      showToast({
        type: "error",
        title: "Invalid icon",
        message:
          error instanceof Error
            ? error.message
            : "The file could not be read.",
      });
    }
  };

  return (
    <div
      className="border-t border-slate-100 pt-4"
      data-testid="app-shortcut-section"
    >
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2.5">
        Mobile App Shortcut (Home Screen)
      </p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-4">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
              Shortcut Icon
            </label>
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 p-3">
              <div
                className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg ring-1 ring-slate-200"
                style={{ backgroundColor: background }}
              >
                <img
                  src={shown}
                  alt="Shortcut icon preview"
                  className="h-[90%] w-[90%] object-contain"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline-emerald"
                  onClick={() => input.current?.click()}
                >
                  Upload Icon
                </Button>
                {icon && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => onChange({ ...config, appIcon: "" })}
                  >
                    Reset
                  </Button>
                )}
              </div>
              {!icon && (
                <span className="text-xs text-slate-500">
                  Built-in icon in use
                </span>
              )}
            </div>
            <input
              ref={input}
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              aria-label="Upload shortcut icon"
              onChange={(e) => {
                void pick(e.target.files?.[0]);
                e.currentTarget.value = "";
              }}
            />
            <p className="mt-1 text-xs text-slate-500">
              Square PNG or JPEG, at least {APP_ICON_MIN_SIDE} x{" "}
              {APP_ICON_MIN_SIDE} pixels, max 3 MB. Keep the logo away from the
              edges: Android crops it to a circle or a rounded shape.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="app-short-name"
                className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5"
              >
                Shortcut Label
              </label>
              <input
                id="app-short-name"
                type="text"
                value={config.appShortName ?? ""}
                maxLength={APP_SHORT_NAME_MAX}
                onChange={(e) =>
                  onChange({
                    ...config,
                    appShortName: e.target.value
                      .replace(/[\r\n\t]+/g, " ")
                      .slice(0, APP_SHORT_NAME_MAX),
                  })
                }
                className="w-full h-9 px-3.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder={(config.systemDisplayName || "EQMS").slice(
                  0,
                  APP_SHORT_NAME_MAX,
                )}
              />
              <p className="mt-1 text-xs text-slate-500">
                Under the icon, up to {APP_SHORT_NAME_MAX} characters. Empty
                uses the display name.
              </p>
            </div>
            <div>
              <span className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                Icon Background
              </span>
              <ColorPickerInput
                value={background}
                onChange={(value) =>
                  onChange({ ...config, appIconBackground: value })
                }
              />
              <p className="mt-1 text-xs text-slate-500">
                Behind the logo. Needed for a transparent logo: iOS would show
                black.
              </p>
            </div>
          </div>
        </div>

        <div>
          <span className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
            Preview on a phone
          </span>
          <div className="flex items-start justify-center gap-6 rounded-xl bg-gradient-to-br from-slate-700 via-slate-600 to-emerald-700 p-5">
            <Tile
              src={shown}
              background={background}
              label={label}
              shape="ios"
              caption="iPhone"
            />
            <Tile
              src={shown}
              background={background}
              label={label}
              shape="android"
              caption="Android"
            />
          </div>
          <div
            className="mt-3 flex gap-2.5 rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900"
            role="note"
          >
            <div className="space-y-1">
              <p>
                <strong>When people see the change.</strong> After Save Changes,
                every new shortcut gets the new icon and the open application
                updates at once.
              </p>
              <p>
                A shortcut that is already on a phone is kept by the phone
                itself: Android refreshes it by itself the next time it checks
                (usually within a few days), while an iPhone keeps the old icon
                until the shortcut is removed and added again.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
