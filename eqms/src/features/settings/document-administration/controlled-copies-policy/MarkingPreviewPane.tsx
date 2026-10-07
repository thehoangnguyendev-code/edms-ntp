import React, { useEffect, useMemo, useRef, useState } from "react";
import Konva from "konva";
import { Group, Image as KonvaImage, Layer, Rect, Stage, Text, Transformer } from "react-konva";
import { ImageOff } from "lucide-react";
import { controlledCopyPolicyApi } from "@/services/api";
import { uncontrolledCopyPolicyApi } from "@/services/api/uncontrolledCopyPolicy";
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
  onPlacementChange: (kind: "stamp" | "watermark", pagesKey: PagesKey, patch: Partial<MarkingPlacementRule> | null) => void;
  /** Controlled Copy policy, issued-copy scenario only: the QR code was dragged or resized (position as fractions of the first page, size in mm). */
  onQrChange?: (patch: { qrCodeX: number; qrCodeY: number; qrCodeSizeMm: number }) => void;
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

const requestPreview = (props: MarkingPreviewPaneProps): Promise<ControlledCopyMarkingPreview> =>
  props.copyType === "UNCONTROLLED"
    ? uncontrolledCopyPolicyApi.previewMarking({ marking: props.marking })
    : controlledCopyPolicyApi.previewMarking({ ...props.draft, scenario: props.scenario });

export const MarkingPreviewPane: React.FC<MarkingPreviewPaneProps> = (props) => {
  const { onPlacementChange, onQrChange } = props;
  const scenario = props.copyType === "UNCONTROLLED" ? undefined : props.scenario;
  const [preview, setPreview] = useState<ControlledCopyMarkingPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const [stageWidth, setStageWidth] = useState(0);
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);

  const [stampBox, setStampBox] = useState<StampBoxState | null>(null);
  const [watermarkBox, setWatermarkBox] = useState<WatermarkBoxState | null>(null);
  const [qrBox, setQrBox] = useState<StampBoxState | null>(null);
  const qrNode = useNormalizedTransform<Konva.Group>();
  const qrTransformer = useRef<Konva.Transformer>(null);
  const stampNode = useNormalizedTransform<Konva.Group>();
  const stampTransformer = useRef<Konva.Transformer>(null);
  const watermarkNode = useNormalizedTransform<Konva.Text>();
  const watermarkTransformer = useRef<Konva.Transformer>(null);

  // One sample paper: a position set here is the position on every page the mark appears on (the Pages choice decides which).
  const pagesKey: PagesKey = "FIRST";
  const place = (kind: "stamp" | "watermark", patch: Partial<MarkingPlacementRule>) => {
    onPlacementChange(kind, "FIRST", patch);
    onPlacementChange(kind, "OTHERS", patch);
  };

  // Measures the available width so the Konva stage (which needs real pixel dimensions) fills its box responsively.
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => setStageWidth(entries[0]?.contentRect.width ?? 0));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const draftKey = JSON.stringify(props.copyType === "UNCONTROLLED" ? props.marking : props.draft);
  // Navigation (which scenario to look at) fetches immediately -- debouncing it just
  // makes switching "Position for" back and forth look like it forgot the position for half a second, which is easy
  // to mistake for the drag itself being lost. Only draftKey (a field edit or a drag commit, which can fire rapidly)
  // is debounced, to avoid flooding the server while the administrator is still typing/dragging.
  const navKey = JSON.stringify({ copyType: props.copyType ?? "CONTROLLED", scenario });
  const previousNavKey = useRef(navKey);
  useEffect(() => {
    const isNavigationOnly = previousNavKey.current !== navKey;
    previousNavKey.current = navKey;
    const requestId = ++requestRef.current;
    const fetchPreview = () => {
      setLoading(true);
      requestPreview(props)
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
  }, [draftKey, navKey]);

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
  // The QR code is draggable only where the policy can store its position: the issued-copy marking of a Controlled Copy.
  const qrMark = onQrChange && scenario === "ISSUED" ? marks.find((m) => m.kind === "QR" && m.layer.startsWith(editable)) : undefined;
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
    setQrBox(
      qrMark
        ? { left: qrMark.x / pw, top: (ph - qrMark.y - qrMark.height) / ph, width: qrMark.width / pw, height: qrMark.height / ph }
        : null,
    );
    // A code dropped on the stamp or the watermark was moved by the server to the nearest free place. Keep that place as the
    // position, so what is saved is what the server prints (it would pick the same place at issue time anyway).
    if (qrMark?.adjusted && onQrChange && props.copyType !== "UNCONTROLLED" && props.draft.marking.qrCodeX != null) {
      onQrChange({
        qrCodeX: round(qrMark.x / pw),
        qrCodeY: round((ph - qrMark.y - qrMark.height) / ph),
        qrCodeSizeMm: props.draft.marking.qrCodeSizeMm,
      });
    }
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

  const pageAspect = preview ? preview.pageHeightPt / preview.pageWidthPt : 1;
  const stageHeight = stageWidth * pageAspect;
  const scale = preview ? stageWidth / preview.pageWidthPt : 1;

  useEffect(() => {
    stampTransformer.current?.nodes(stampBox && stampNode.ref.current ? [stampNode.ref.current] : []);
    stampTransformer.current?.getLayer()?.batchDraw();
  }, [stampBox, stampNode.ref]);
  useEffect(() => {
    qrTransformer.current?.nodes(qrBox && qrNode.ref.current ? [qrNode.ref.current] : []);
    qrTransformer.current?.getLayer()?.batchDraw();
  }, [qrBox, qrNode.ref]);
  useEffect(() => {
    watermarkTransformer.current?.nodes(watermarkBox && watermarkNode.ref.current ? [watermarkNode.ref.current] : []);
    watermarkTransformer.current?.getLayer()?.batchDraw();
  }, [watermarkBox, watermarkNode.ref]);

  const commitStamp = (box: StampBoxState) =>
    place("stamp", { stampX: round(box.left), stampY: round(box.top), stampWidthPercent: Math.round(box.width * 100) });

  const commitWatermark = (box: WatermarkBoxState, scalePercent: number) => {
    watermarkScalePercentRef.current = scalePercent;
    place("watermark", {
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

  // The QR code is dragged and resized exactly like the stamp (Konva Group + Transformer); the ratio is kept so it stays square.
  // Its size is stored in millimetres (15-40), so a resize multiplies the stored size by the scale instead of guessing one.
  const qrSizeMm = props.copyType === "UNCONTROLLED" ? 20 : props.draft.marking.qrCodeSizeMm;
  const commitQr = (box: StampBoxState, sizeMm: number) =>
    onQrChange?.({ qrCodeX: round(box.left), qrCodeY: round(box.top), qrCodeSizeMm: sizeMm });

  const handleQrDragEnd = () => {
    const node = qrNode.ref.current;
    if (!node || !qrBox) return;
    const next: StampBoxState = { ...qrBox, left: node.x() / stageWidth, top: node.y() / stageHeight };
    setQrBox(next);
    commitQr(next, qrSizeMm);
  };

  const handleQrTransformEnd = () => {
    const node = qrNode.ref.current;
    if (!node || !qrBox) return;
    const scaleFactor = (node.scaleX() + node.scaleY()) / 2;
    qrNode.resetScale();
    const sizeMm = Math.min(40, Math.max(15, Math.round(qrSizeMm * scaleFactor)));
    const ratio = sizeMm / qrSizeMm;
    const next: StampBoxState = {
      left: node.x() / stageWidth,
      top: node.y() / stageHeight,
      width: qrBox.width * ratio,
      height: qrBox.height * ratio,
    };
    setQrBox(next);
    commitQr(next, sizeMm);
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

              {qrBox && (
                <Group
                  ref={qrNode.ref}
                  x={qrBox.left * stageWidth}
                  y={qrBox.top * stageHeight}
                  draggable
                  dragBoundFunc={(pos) => ({
                    x: Math.max(0, Math.min(pos.x, stageWidth - qrBox.width * stageWidth)),
                    y: Math.max(0, Math.min(pos.y, stageHeight - qrBox.height * stageHeight)),
                  })}
                  onDragEnd={handleQrDragEnd}
                  onTransformEnd={handleQrTransformEnd}
                >
                  <Rect width={qrBox.width * stageWidth} height={qrBox.height * stageHeight} stroke="#7c3aed" strokeWidth={2} fill="#7c3aed1a" />
                  <Text
                    width={qrBox.width * stageWidth}
                    height={qrBox.height * stageHeight}
                    text="QR"
                    align="center"
                    verticalAlign="middle"
                    fontStyle="bold"
                    fontSize={12}
                    fill="#7c3aed"
                  />
                </Group>
              )}
              {qrBox && (
                <Transformer
                  ref={qrTransformer}
                  rotateEnabled={false}
                  keepRatio
                  enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right"]}
                  borderStroke="#7c3aed"
                  anchorStroke="#7c3aed"
                  anchorFill="#ffffff"
                  boundBoxFunc={(oldBox, newBox) => (newBox.width < 24 || newBox.height < 24 ? oldBox : newBox)}
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
            {loading ? "Drawing the preview..." : error ?? "No preview yet"}
          </div>
        )}
      </div>

      {error && preview && <p className="text-xs text-red-600">{error}</p>}
      {preview?.note && <p className="text-2xs text-slate-500">{preview.note}</p>}
    </div>
  );
};
