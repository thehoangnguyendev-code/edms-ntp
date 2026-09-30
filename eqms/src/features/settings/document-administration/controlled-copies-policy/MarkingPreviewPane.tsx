import React, { useEffect, useMemo, useRef, useState } from "react";
import Konva from "konva";
import { Group, Image as KonvaImage, Layer, Rect, Stage, Text, Transformer } from "react-konva";
import { ImageOff } from "lucide-react";
import { Select } from "@/components/ui/select";
import { controlledCopyPolicyApi } from "@/services/api";
import { uncontrolledCopyPolicyApi } from "@/services/api/uncontrolledCopyPolicy";
import { publishingTemplatesApi } from "@/services/api/publishingTemplates";
import type { PublishingTemplateResponse } from "@/features/documents/publishing/types";
import type {
  ControlledCopyMarkingPreview,
  ControlledCopyMarkingPreviewRequest,
  ControlledCopyStatusMarking,
  MarkingPlacementRule,
} from "@/services/api/controlledCopyPolicy";
import { extractApiMessage } from "@/features/settings/dictionaries/utils";
import { IconImageGeneration } from "@tabler/icons-react";

type Draft = Pick<ControlledCopyMarkingPreviewRequest, "distributionSecurity" | "marking" | "statusMarking">;
type PagesKey = "FIRST" | "OTHERS";
/** Fractions of the page (0..1, top-down/left-right), the same convention {@link MarkingPlacementRule} uses. */
interface StampBoxState {
  left: number;
  top: number;
  width: number;
  height: number;
}
interface WatermarkBoxState {
  centreX: number;
  centreY: number;
  width: number;
  height: number;
  /** PDF convention: 0 = horizontal, measured counter-clockwise (opposite of Konva's on-screen `rotation`). */
  angle: number;
}

type PreviewLayout = "portrait" | "landscape";
interface PreviewTemplateOption {
  label: string;
  value: string;
  availableLayouts: PreviewLayout[];
}

const getAvailableLayouts = (template: PublishingTemplateResponse): PreviewLayout[] => {
  const layouts = (["portrait", "landscape"] as PreviewLayout[]).filter((layout) =>
    (template.components ?? []).some(
      (component) =>
        component.componentType?.toLowerCase() === "cover" &&
        component.layout?.toLowerCase() === layout &&
        Boolean(component.objectKey),
    ),
  );
  // Legacy component fields contain the Portrait file only; they must never imply Landscape.
  if (!layouts.includes("portrait") && Boolean(template.coverTemplatePath || template.coverFileName)) {
    layouts.unshift("portrait");
  }
  return layouts;
};

/** Which layer name (from the server's response) the administrator may drag in each scenario -- the other layer, when
 *  present, is shown for reference only (e.g. the issued stamp while editing the withdrawn stamp). */
const editableLayer = (scenario: ControlledCopyMarkingPreviewRequest["scenario"]) =>
  scenario === "ISSUED" ? "Issued" : "Status";

const round = (value: number) => Math.round(value * 10000) / 10000;
const normalizeAngle = (deg: number) => {
  // The backend accepts -90..90 -- going past +-90 to reach the other diagonal ("\") the long way
  // (90..180) rotates the *text* upside down along with the line, since that continues past
  // vertical. A negative (clockwise) angle reaches the same "\" diagonal while the text still
  // reads normally, so any drag angle is wrapped into -90..90 rather than 0..180.
  const wrapped = ((deg % 360) + 360) % 360; // 0..360
  const centered = wrapped > 180 ? wrapped - 360 : wrapped; // -180..180
  if (centered > 90) return centered - 180;
  if (centered < -90) return centered + 180;
  return centered;
};

/** One "solved" position + on-canvas dimensions, resettable to 1 after each transform (the standard Konva pattern for a
 *  controlled shape driven by React state rather than by Konva's own accumulated scale). */
function useNormalizedTransform<T extends Konva.Node>() {
  const ref = useRef<T>(null);
  const resetScale = () => {
    ref.current?.scaleX(1);
    ref.current?.scaleY(1);
  };
  return { ref, resetScale };
}

interface CommonPaneProps {
  pageKind: "COVER" | "BODY";
  onPageKindChange: (kind: "COVER" | "BODY") => void;
  onPlacementChange: (kind: "stamp" | "watermark", pagesKey: PagesKey, patch: Partial<MarkingPlacementRule> | null) => void;
}

/**
 * CONTROLLED (default): the Controlled Copies Policy draft + scenario, previewed by the controlled-copies-policy endpoint.
 * UNCONTROLLED: the single Uncontrolled Copies Policy marking, previewed by the uncontrolled-copies-policy endpoint. The
 * server reports its marks under the "Status" layer, so the same drag/resize editor below works unchanged for both.
 */
export type MarkingPreviewPaneProps = CommonPaneProps &
  (
    | { copyType?: "CONTROLLED"; scenario: ControlledCopyMarkingPreviewRequest["scenario"]; draft: Draft }
    | { copyType: "UNCONTROLLED"; marking: ControlledCopyStatusMarking }
  );

type PreviewNav = Pick<ControlledCopyMarkingPreviewRequest, "templateId" | "layout" | "pageKind">;

const requestPreview = (props: MarkingPreviewPaneProps, nav: PreviewNav): Promise<ControlledCopyMarkingPreview> =>
  props.copyType === "UNCONTROLLED"
    ? uncontrolledCopyPolicyApi.previewMarking({ ...nav, marking: props.marking })
    : controlledCopyPolicyApi.previewMarking({ ...props.draft, ...nav, scenario: props.scenario });

export const MarkingPreviewPane: React.FC<MarkingPreviewPaneProps> = (props) => {
  const { pageKind, onPageKindChange, onPlacementChange } = props;
  const scenario = props.copyType === "UNCONTROLLED" ? undefined : props.scenario;
  const [templates, setTemplates] = useState<PreviewTemplateOption[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [layout, setLayout] = useState<PreviewLayout>("portrait");
  const [preview, setPreview] = useState<ControlledCopyMarkingPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const [stageWidth, setStageWidth] = useState(0);
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);

  const [stampBox, setStampBox] = useState<StampBoxState | null>(null);
  const [watermarkBox, setWatermarkBox] = useState<WatermarkBoxState | null>(null);
  const stampNode = useNormalizedTransform<Konva.Group>();
  const stampTransformer = useRef<Konva.Transformer>(null);
  const watermarkNode = useNormalizedTransform<Konva.Text>();
  const watermarkTransformer = useRef<Konva.Transformer>(null);

  const pagesKey: PagesKey = pageKind === "COVER" ? "FIRST" : "OTHERS";

  useEffect(() => {
    let alive = true;
    publishingTemplatesApi
      .getTemplates({ status: "ACTIVE", limit: 50 })
      .then((page) => {
        if (!alive) return;
        const options = (page.data ?? [])
          .filter((t): t is typeof t & { id: string; templateName: string } => Boolean(t.id && t.templateName))
          .map((t) => ({
            label: t.templateName,
            value: t.id,
            availableLayouts: getAvailableLayouts(t),
          }));
        setTemplates(options);
        setTemplateId((current) => current || options[0]?.value || "");
      })
      .catch(() => {
        if (alive) setTemplates([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.value === templateId),
    [templateId, templates],
  );
  const layoutAvailable = Boolean(selectedTemplate?.availableLayouts.includes(layout));
  const layoutWarning = selectedTemplate && !layoutAvailable
    ? `${selectedTemplate.label} does not have a ${layout === "portrait" ? "Portrait" : "Landscape"} layout. Upload and publish that layout before previewing it.`
    : null;

  // Measures the available width so the Konva stage (which needs real pixel dimensions) fills its box responsively.
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => setStageWidth(entries[0]?.contentRect.width ?? 0));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const draftKey = JSON.stringify(props.copyType === "UNCONTROLLED" ? props.marking : props.draft);
  // Navigation (which page/template/layout/scenario to look at) fetches immediately -- debouncing it just
  // makes switching "Position for" back and forth look like it forgot the position for half a second, which is easy
  // to mistake for the drag itself being lost. Only draftKey (a field edit or a drag commit, which can fire rapidly)
  // is debounced, to avoid flooding the server while the administrator is still typing/dragging.
  const navKey = JSON.stringify({ copyType: props.copyType ?? "CONTROLLED", templateId, layout, pageKind, scenario });
  const previousNavKey = useRef(navKey);
  useEffect(() => {
    if (!templateId) return;
    if (!layoutAvailable) {
      requestRef.current += 1;
      setPreview(null);
      setError(null);
      setLoading(false);
      return;
    }
    const isNavigationOnly = previousNavKey.current !== navKey;
    previousNavKey.current = navKey;
    const requestId = ++requestRef.current;
    const fetchPreview = () => {
      setLoading(true);
      requestPreview(props, { templateId, layout, pageKind })
        .then((result) => {
          if (requestId !== requestRef.current) return;
          setPreview(result);
          setError(null);
        })
        .catch((err) => {
          if (requestId !== requestRef.current) return;
          setError(extractApiMessage(err, "Unable to draw the preview."));
        })
        .finally(() => {
          if (requestId === requestRef.current) setLoading(false);
        });
    };
    if (isNavigationOnly) {
      fetchPreview();
      return;
    }
    const timer = window.setTimeout(fetchPreview, 500);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey, navKey, layoutAvailable]);

  // The background is whatever page the server just rendered -- reloaded as a plain <img> would be, but Konva needs an
  // actual HTMLImageElement instance to draw from.
  useEffect(() => {
    if (!preview) {
      setBgImage(null);
      return;
    }
    let alive = true;
    const image = new window.Image();
    image.onload = () => {
      if (alive) setBgImage(image);
    };
    image.src = `data:image/png;base64,${preview.imageBase64}`;
    return () => {
      alive = false;
    };
  }, [preview?.imageBase64]);

  const editable = scenario ? editableLayer(scenario) : "Status";
  const marks = preview?.marks ?? [];
  const stampMark = marks.find((m) => m.kind === "STAMP" && m.layer.startsWith(editable));
  const watermarkMark = marks.find((m) => m.kind === "WATERMARK" && m.layer.startsWith(editable));
  const referenceMarks = marks.filter((m) => !m.layer.startsWith(editable));

  // A fresh server render (a new template/page/scenario, or the round trip after the previous drag was saved) replaces
  // whatever the shapes were showing with the server's own confirmed layout.
  useEffect(() => {
    if (!preview) return;
    const pw = preview.pageWidthPt;
    const ph = preview.pageHeightPt;
    setStampBox(
      stampMark
        ? { left: stampMark.x / pw, top: (ph - stampMark.y - stampMark.height) / ph, width: stampMark.width / pw, height: stampMark.height / ph }
        : null,
    );
    setWatermarkBox(
      watermarkMark
        ? {
            centreX: (watermarkMark.x + watermarkMark.width / 2) / pw,
            centreY: (ph - (watermarkMark.y + watermarkMark.height / 2)) / ph,
            width: watermarkMark.width / pw,
            height: watermarkMark.height / ph,
            angle: watermarkMark.angle,
          }
        : null,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview]);

  // The scale% a placement rule already holds for this page group (if the administrator set one before), so a further
  // resize multiplies it further rather than guessing an absolute size from the rendered (already-scaled) preview.
  const existingWatermarkScalePercent = useMemo(() => {
    const placements =
      props.copyType === "UNCONTROLLED"
        ? props.marking.placements
        : props.scenario === "ISSUED"
          ? props.draft.marking.placements
          : props.draft.statusMarking[props.scenario]?.placements;
    return placements?.find((rule) => rule.pages === pagesKey)?.watermarkScalePercent ?? 100;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey, scenario, pagesKey]);
  const watermarkScalePercentRef = useRef(existingWatermarkScalePercent);
  watermarkScalePercentRef.current = existingWatermarkScalePercent;

  // "Pages" (Every page / First page only, issued-copy marking only -- a status mark always applies to every page)
  // decides whether a mark exists at all on page 2+; it is a different setting from the page picker above, which only
  // chooses which page's position you are dragging right now. Warn here so setting a position on a page the mark
  // will never actually appear on (because its own Pages scope excludes it) isn't mistaken for a bug.
  // Uncontrolled copy: the watermark is forced onto every page by the server; only the stamp honours "First page only".
  const hiddenOnThisPage =
    pageKind !== "BODY"
      ? []
      : props.copyType === "UNCONTROLLED"
        ? props.marking.stampEnabled && props.marking.stampPages === "FIRST" ? ["stamp"] : []
        : props.scenario === "ISSUED"
          ? [
              props.draft.marking.watermarkPages === "FIRST" ? "watermark" : null,
              props.draft.marking.stampPages === "FIRST" ? "stamp" : null,
            ].filter((v): v is string => v !== null)
          : [];

  const pageAspect = preview ? preview.pageHeightPt / preview.pageWidthPt : 1;
  const stageHeight = stageWidth * pageAspect;
  const scale = preview ? stageWidth / preview.pageWidthPt : 1;

  useEffect(() => {
    stampTransformer.current?.nodes(stampBox && stampNode.ref.current ? [stampNode.ref.current] : []);
    stampTransformer.current?.getLayer()?.batchDraw();
  }, [stampBox, stampNode.ref]);
  useEffect(() => {
    watermarkTransformer.current?.nodes(watermarkBox && watermarkNode.ref.current ? [watermarkNode.ref.current] : []);
    watermarkTransformer.current?.getLayer()?.batchDraw();
  }, [watermarkBox, watermarkNode.ref]);

  const commitStamp = (box: StampBoxState) =>
    onPlacementChange("stamp", pagesKey, { stampX: round(box.left), stampY: round(box.top), stampWidthPercent: Math.round(box.width * 100) });

  const commitWatermark = (box: WatermarkBoxState, scalePercent: number) => {
    watermarkScalePercentRef.current = scalePercent;
    onPlacementChange("watermark", pagesKey, {
      watermarkX: round(box.centreX),
      watermarkY: round(box.centreY),
      watermarkScalePercent: Math.round(scalePercent),
      watermarkAngleDegrees: Math.round(box.angle),
    });
  };

  const handleStampDragEnd = () => {
    const node = stampNode.ref.current;
    if (!node || !stampBox) return;
    const next: StampBoxState = { ...stampBox, left: node.x() / stageWidth, top: node.y() / stageHeight };
    setStampBox(next);
    commitStamp(next);
  };

  const handleStampTransformEnd = () => {
    const node = stampNode.ref.current;
    if (!node || !stampBox) return;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    stampNode.resetScale();
    const next: StampBoxState = {
      left: node.x() / stageWidth,
      top: node.y() / stageHeight,
      width: Math.min(0.6, Math.max(0.05, stampBox.width * scaleX)),
      height: stampBox.height * scaleY,
    };
    setStampBox(next);
    commitStamp(next);
  };

  const handleWatermarkDragEnd = () => {
    const node = watermarkNode.ref.current;
    if (!node || !watermarkBox) return;
    const next: WatermarkBoxState = { ...watermarkBox, centreX: node.x() / stageWidth, centreY: node.y() / stageHeight };
    setWatermarkBox(next);
    commitWatermark(next, watermarkScalePercentRef.current);
  };

  const handleWatermarkTransformEnd = () => {
    const node = watermarkNode.ref.current;
    if (!node || !watermarkBox) return;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    watermarkNode.resetScale();
    const next: WatermarkBoxState = {
      centreX: node.x() / stageWidth,
      centreY: node.y() / stageHeight,
      width: watermarkBox.width * scaleX,
      height: watermarkBox.height * scaleY,
      angle: normalizeAngle(-node.rotation()),
    };
    setWatermarkBox(next);
    commitWatermark(next, watermarkScalePercentRef.current * ((scaleX + scaleY) / 2));
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
        <Select
          label="Preview on template"
          value={templateId}
          onChange={(v) => setTemplateId(String(v))}
          options={templates.map(({ label, value }) => ({ label, value }))}
          placeholder={templates.length === 0 ? "No active Publishing Template" : "Select a template"}
          enableSearch={false}
        />
        <div className="min-w-0">
          <Select
            label="Position for"
            value={pageKind}
            onChange={(v) => onPageKindChange(v as "COVER" | "BODY")}
            options={[
              { label: "Cover page (page 1)", value: "COVER" },
              { label: "Following pages (page 2+)", value: "BODY" },
            ]}
            enableSearch={false}
          />
          <p className="mt-1 text-2xs text-slate-400">Which page you're dragging on now -- not whether the mark shows there (see Pages below).</p>
        </div>
        <Select
          label="Paper layout"
          value={layout}
          onChange={(v) => setLayout(v as PreviewLayout)}
          options={[
            { label: "Portrait", value: "portrait" },
            { label: "Landscape", value: "landscape" },
          ]}
          enableSearch={false}
        />
      </div>

      {layoutWarning && (
        <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-2xs text-amber-800">
          {layoutWarning}
        </p>
      )}

      {hiddenOnThisPage.length > 0 && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-2xs text-amber-800">
          The {hiddenOnThisPage.join(" and ")} is set to "First page only" under Pages, so it won't actually appear on this
          page -- any position set here has no effect until that is changed to "Every page".
        </p>
      )}

      <div ref={containerRef} className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-100" style={{ minHeight: 240 }}>
        {preview && bgImage && stageWidth > 0 ? (
          <Stage width={stageWidth} height={stageHeight} className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
            <Layer listening={false}>
              <KonvaImage image={bgImage} width={stageWidth} height={stageHeight} />
            </Layer>
            <Layer>
              {referenceMarks.map((mark, index) => {
                const isWatermark = mark.kind === "WATERMARK";
                const width = mark.width * scale;
                const height = mark.height * scale;
                return (
                  <Rect
                    key={`ref-${index}`}
                    x={isWatermark ? (mark.x + mark.width / 2) * scale : mark.x * scale}
                    y={
                      isWatermark
                        ? stageHeight - (mark.y + mark.height / 2) * scale
                        : stageHeight - (mark.y + mark.height) * scale
                    }
                    offsetX={isWatermark ? width / 2 : 0}
                    offsetY={isWatermark ? height / 2 : 0}
                    width={width}
                    height={height}
                    rotation={isWatermark ? -mark.angle : 0}
                    stroke="#94a3b8"
                    dash={[6, 4]}
                    listening={false}
                  />
                );
              })}

              {stampBox && (
                <Group
                  ref={stampNode.ref}
                  x={stampBox.left * stageWidth}
                  y={stampBox.top * stageHeight}
                  draggable
                  dragBoundFunc={(pos) => ({
                    x: Math.max(0, Math.min(pos.x, stageWidth - stampBox.width * stageWidth)),
                    y: Math.max(0, Math.min(pos.y, stageHeight - stampBox.height * stageHeight)),
                  })}
                  onDragEnd={handleStampDragEnd}
                  onTransformEnd={handleStampTransformEnd}
                >
                  <Rect width={stampBox.width * stageWidth} height={stampBox.height * stageHeight} stroke="#0284c7" strokeWidth={2} fill="#0284c71a" />
                  <Text
                    width={stampBox.width * stageWidth}
                    height={stampBox.height * stageHeight}
                    text="STAMP"
                    align="center"
                    verticalAlign="middle"
                    fontStyle="bold"
                    fontSize={12}
                    fill="#0284c7"
                  />
                </Group>
              )}
              {stampBox && (
                <Transformer
                  ref={stampTransformer}
                  rotateEnabled={false}
                  keepRatio={false}
                  enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right"]}
                  borderStroke="#0284c7"
                  anchorStroke="#0284c7"
                  anchorFill="#ffffff"
                  boundBoxFunc={(oldBox, newBox) => (newBox.width < 30 || newBox.height < 16 ? oldBox : newBox)}
                />
              )}

              {watermarkBox && (
                <Text
                  ref={watermarkNode.ref}
                  x={watermarkBox.centreX * stageWidth}
                  y={watermarkBox.centreY * stageHeight}
                  offsetX={(watermarkBox.width * stageWidth) / 2}
                  offsetY={(watermarkBox.height * stageHeight) / 2}
                  width={watermarkBox.width * stageWidth}
                  height={watermarkBox.height * stageHeight}
                  rotation={-watermarkBox.angle}
                  text="WATERMARK"
                  align="center"
                  verticalAlign="middle"
                  fontStyle="bold"
                  fontSize={18}
                  fill="#059669"
                  opacity={0.85}
                  draggable
                  onDragEnd={handleWatermarkDragEnd}
                  onTransformEnd={handleWatermarkTransformEnd}
                />
              )}
              {watermarkBox && (
                <Transformer
                  ref={watermarkTransformer}
                  rotateEnabled
                  keepRatio
                  enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right"]}
                  borderStroke="#059669"
                  anchorStroke="#059669"
                  anchorFill="#ffffff"
                  boundBoxFunc={(oldBox, newBox) => (newBox.width < 30 || newBox.height < 14 ? oldBox : newBox)}
                />
              )}
            </Layer>
          </Stage>
        ) : (
          <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-2 px-4 text-center text-sm text-slate-500">
            <IconImageGeneration className="h-6 w-6 text-slate-300" />
            {templateId ? (loading ? "Drawing the preview..." : error ?? "No preview yet") : "Choose a Publishing Template to preview on."}
          </div>
        )}
      </div>

      {error && preview && <p className="text-xs text-red-600">{error}</p>}
      {preview?.note && <p className="text-2xs text-slate-500">{preview.note}</p>}
    </div>
  );
};
