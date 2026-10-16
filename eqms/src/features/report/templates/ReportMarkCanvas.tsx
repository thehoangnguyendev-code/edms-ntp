import { useEffect, useRef, useState } from "react";
import type Konva from "konva";
import {
  Stage,
  Layer,
  Image as CanvasImage,
  Text,
  Transformer,
} from "react-konva";
import { Select } from "@/components/ui/select";
import { ReportStampBox, type StampBoxState } from "./ReportStampBox";
import { Button } from "@/components/ui/button";
import {
  reportTemplatesApi,
  reportError,
  defaultReportMark,
  defaultReportStamp,
  type ReportPagePreview,
  type ReportLayout,
  type ReportMark,
} from "@/services/api/reportTemplates";

/** Same Konva/Transformer library as Controlled Copy; commits draft geometry only. */
export function ReportMarkCanvas({
  title,
  layout,
  disabled,
  onChange,
}: {
  title: string;
  layout: ReportLayout;
  disabled: boolean;
  onChange: (value: ReportLayout) => void;
}) {
  const [kind, setKind] = useState<"watermark" | "logo">("watermark");
  const [logoImage, setLogoImage] = useState<HTMLImageElement>();
  const logoNode = useRef<Konva.Image>(null);
  const logo = layout.logo;
  useEffect(() => {
    let alive = true;
    setLogoImage(undefined);
    if (logo?.data) {
      const img = new Image();
      img.onload = () => {
        if (alive) setLogoImage(img);
      };
      img.src = logo.data;
    }
    return () => {
      alive = false;
    };
  }, [logo?.data]);
  const [page, setPage] = useState(1);
  const [image, setImage] = useState<HTMLImageElement>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [stampBox, setStampBox] = useState<StampBoxState | null>(null);
  const [width, setWidth] = useState(0);
  const box = useRef<HTMLDivElement>(null),
    node = useRef<Konva.Text>(null),
    transformer = useRef<Konva.Transformer>(null);
  const style = layout.watermarkStyle ?? defaultReportMark();
  // The server draws the stamp into the page and says where it put it, so the frame is always over the stamp, whichever mark is being edited; the
  // logo and the watermark are drawn here, so the one being edited is left out of the page.
  const background = {
    ...layout,
    ...(kind === "logo"
      ? { logo: undefined }
      : {
          watermarkEnabled: false,
          watermarkStyle: undefined,
          watermark: "",
        }),
  };
  const pages = 1 + (layout.cover ? 1 : 0) + (layout.charts?.length ?? 0);
  const selectedPage = Math.min(page, pages);
  const visible =
    (kind === "logo"
      ? !!logo?.enabled
      : layout.watermarkEnabled) &&
    (selectedPage === 1 ||
      (kind === "logo" ? logo?.pages : style.pages) === "ALL");
  const key = JSON.stringify([title, background, selectedPage]);
  // A stamp that is not shown (off, or not on this page) has no frame: the server reports where it put the stamp only when it drew it.
  const stampFrame = layout.stampEnabled ? stampBox : null;
  useEffect(() => {
    if (!box.current) return;
    const observer = new ResizeObserver((entries) =>
      setWidth(entries[0]?.contentRect.width ?? 0),
    );
    observer.observe(box.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let alive = true;
    const abort = new AbortController();
    setError("");
    setBusy(true);
    setImage(undefined);
    if (disabled || !title.trim()) {
      setBusy(false);
      return;
    }
    const timer = window.setTimeout(() => {
      reportTemplatesApi
        .previewPage(title, background, selectedPage, abort.signal)
        .then((preview: ReportPagePreview) => {
          if (!alive) return;
          const next = new Image();
          next.onload = () => {
            if (alive) {
              const mark = preview.marks.find((m) => m.kind === "STAMP");
              const pw = preview.pageWidthPt;
              const ph = preview.pageHeightPt;
              setStampBox(mark ? { left: mark.x / pw, top: (ph - mark.y - mark.height) / ph, width: mark.width / pw, height: mark.height / ph } : null);
              setImage(next);
              setBusy(false);
            }
          };
          next.onerror = () => {
            if (alive) {
              setError("Unable to display the rendered page.");
              setBusy(false);
            }
          };
          next.src = `data:image/png;base64,${preview.imageBase64}`;
        })
        .catch((err) => {
          if (alive) {
            setError(reportError(err));
            setBusy(false);
          }
        });
    }, 500);
    return () => {
      alive = false;
      window.clearTimeout(timer);
      abort.abort();
    };
    // The selected overlay is excluded from the key, so dragging never reruns Word conversion.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, disabled]);
  useEffect(() => {
    const selected = kind === "logo" ? logoNode.current : kind === "watermark" ? node.current : null;
    transformer.current?.nodes(visible && selected ? [selected] : []);
    transformer.current?.getLayer()?.batchDraw();
  }, [visible, image, kind, width, logoImage]);
  const pageWidth = layout.orientation === "PORTRAIT" ? 595 : 842,
    pageHeight = layout.orientation === "PORTRAIT" ? 842 : 595;
  const height = (width * pageHeight) / pageWidth,
    scale = width / pageWidth;
  const patch = (update: Partial<ReportMark>) =>
    onChange({
      ...layout,
      watermarkStyle: {
        ...style,
        ...update,
      },
    });
  const placeStamp = (placement: { x: number; y: number; width?: number }) =>
    onChange({ ...layout, stampStyle: { ...(layout.stampStyle ?? defaultReportStamp()), ...placement } });
  const commit = () => {
    const shape = kind === "logo" ? logoNode.current : node.current;
    if (!shape) return;
    if (kind === "logo" && logo) {
      const x = Math.max(0, Math.min(90, (shape.x() / width) * 100)),
        y = Math.max(0, Math.min(90, (shape.y() / height) * 100));
      const nextWidth = Math.max(
        5,
        Math.min(100 - x, ((shape.width() * shape.scaleX()) / width) * 100),
      );
      shape.scale({ x: 1, y: 1 });
      onChange({ ...layout, logo: { ...logo, x, y, width: nextWidth } });
      return;
    }
    const x = Math.max(0, Math.min(95, (shape.x() / width) * 100)),
      y = Math.max(0, Math.min(98, (shape.y() / height) * 100));
    const nextWidth = Math.max(
      5,
      Math.min(100 - x, style.width * shape.scaleX()),
    );
    const fontSize = Math.max(6, Math.min(96, style.fontSize * shape.scaleY()));
    const rotation = ((((-shape.rotation() + 180) % 360) + 360) % 360) - 180;
    shape.scale({ x: 1, y: 1 });
    patch({ x, y, width: nextWidth, fontSize, rotation });
  };
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          label="Edit mark"
          value={kind}
          disabled={disabled}
          enableSearch={false}
          options={[
            { value: "logo", label: "Logo" },
            { value: "watermark", label: "Watermark" },
          ]}
          onChange={(value) => setKind(value as typeof kind)}
        />
        <Select
          label="Position for"
          disabled={disabled}
          value={selectedPage}
          enableSearch={false}
          options={Array.from({ length: pages }, (_, index) => ({
            value: index + 1,
            label:
              index === 0 && layout.cover
                ? "Cover page (page 1)"
                : `Report page ${index + 1}`,
          }))}
          onChange={(value) => setPage(Number(value))}
        />
      </div>
      <Select
        label="Paper layout"
        value={layout.orientation ?? "LANDSCAPE"}
        disabled={disabled}
        enableSearch={false}
        options={[
          { value: "PORTRAIT", label: "Portrait" },
          { value: "LANDSCAPE", label: "Landscape" },
        ]}
        onChange={(orientation) =>
          onChange({
            ...layout,
            orientation: orientation as ReportLayout["orientation"],
          })
        }
      />
      <p className="text-xs text-slate-500">
        Drag to move. Use corner handles to resize and the upper handle to rotate. The stamp has its own blue frame: drag it to move the stamp and use its
        corner handles to resize it. The page background is rendered by the server.
      </p>
      {!visible && (
        <p role="status" className="text-sm text-slate-500">
          {kind === "logo" ? "The logo" : "The watermark"} is not shown: enable it in its settings and select a page where it applies.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <div
        ref={box}
        className="min-h-48 overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
      >
        {image && width > 0 ? (
          <Stage width={width} height={height}>
            <Layer listening={false}>
              <CanvasImage image={image} width={width} height={height} />
            </Layer>
            <Layer>
              {visible && kind === "logo" && logo && logoImage && (
                <CanvasImage
                  ref={logoNode}
                  image={logoImage}
                  x={(logo.x * width) / 100}
                  y={Math.min(
                    (logo.y * height) / 100,
                    height -
                      Math.min(
                        (((logo.width * pageWidth) / 100) * logoImage.height) /
                          logoImage.width,
                        140,
                      ) *
                        scale,
                  )}
                  width={
                    Math.min(
                      (logo.width * pageWidth) / 100,
                      (140 * logoImage.width) / logoImage.height,
                    ) * scale
                  }
                  height={
                    Math.min(
                      (((logo.width * pageWidth) / 100) * logoImage.height) /
                        logoImage.width,
                      140,
                    ) * scale
                  }
                  draggable={!disabled}
                  onDragEnd={commit}
                  onTransformEnd={commit}
                />
              )}
              {visible && kind === "watermark" && (
                <Text
                  ref={node}
                  x={(style.x * width) / 100}
                  y={(style.y * height) / 100}
                  offsetY={style.fontSize * scale}
                  width={(style.width * width) / 100}
                  text={layout.watermark}
                  fontFamily={
                    {
                      NOTO_SANS: "Noto Sans",
                      NOTO_SERIF: "Noto Serif",
                      ROBOTO_MONO: "Roboto Mono",
                      OSWALD: "Oswald",
                      TIMES_NEW_ROMAN: '"Times New Roman", Tinos, serif',
                    }[style.font] ?? "Noto Sans"
                  }
                  wrap="none"
                  fontSize={style.fontSize * scale}
                  fill={style.color}
                  opacity={style.opacity / 100}
                  rotation={-style.rotation}
                  draggable={!disabled}
                  onDragEnd={commit}
                  onTransformEnd={commit}
                />
              )}
              {stampFrame && !disabled && (
                <ReportStampBox
                  box={stampFrame}
                  stageWidth={width}
                  stageHeight={height}
                  onBox={setStampBox}
                  onChange={placeStamp}
                />
              )}
              {visible && !disabled && (
                <Transformer
                  ref={transformer}
                  rotateEnabled={kind !== "logo"}
                  keepRatio={kind === "logo"}
                  flipEnabled={false}
                  padding={6}
                  enabledAnchors={[
                    "top-left",
                    "top-right",
                    "bottom-left",
                    "bottom-right",
                  ]}
                  borderStroke="#059669"
                  anchorStroke="#059669"
                  anchorFill="#ffffff"
                  boundBoxFunc={(oldBox, next) =>
                    next.width < 20 || next.height < 2 ? oldBox : next
                  }
                />
              )}
            </Layer>
          </Stage>
        ) : (
          <p role="status" className="p-6 text-sm text-slate-500">
            {busy ? "Rendering page on server…" : "No page available."}
          </p>
        )}
      </div>
      <Button
        variant="outline-emerald"
        size="sm"
        disabled={disabled}
        onClick={() => {
          if (kind === "logo" && logo) {
            onChange({ ...layout, logo: { ...logo, x: 5, y: 8, width: 18 } });
            return;
          }
          const defaults = defaultReportMark();
          patch({
            x: defaults.x,
            y: defaults.y,
            width: defaults.width,
            rotation: defaults.rotation,
          });
        }}
      >
        Reset Position
      </Button>
    </div>
  );
}
