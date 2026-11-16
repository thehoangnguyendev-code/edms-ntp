import { useEffect, useRef } from "react";
import type Konva from "konva";
import { Group, Layer, Rect, Stage, Text, Transformer } from "react-konva";
import { defaultReportMark, type ReportLayout } from "@/services/api/reportTemplates";

const round = (value: number) => Math.round(value * 100) / 100;
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
/** The server takes -180..180; a drag past it comes round the other way. */
const normalizeAngle = (degrees: number) => {
  const wrapped = ((degrees % 360) + 360) % 360;
  return wrapped > 180 ? wrapped - 360 : wrapped;
};

/** The place of a stamp that has not been placed by hand: the top right corner, as the server draws it. */
const DEFAULT_STAMP_Y = 3;

/**
 * The watermark and the stamp drawn with Konva over the page, dragged, resized and (the watermark) turned the way the PDF Marking of a Controlled Copy does it:
 * a Transformer with corner handles, the stamp without turning. Positions are kept as a percentage of the page, as the server keeps them. (REPORT-APPEARANCE-2026-11-14)
 */
export default function ReportMarkOverlay({
  layout,
  width,
  pageWidth,
  pageHeight,
  watermarkShown,
  stampShown,
  selected,
  fontFamily,
  onSelect,
  onChange,
}: {
  layout: ReportLayout;
  /** The width of the drawn page in pixels: the stage fills it. */
  width: number;
  pageWidth: number;
  pageHeight: number;
  watermarkShown: boolean;
  stampShown: boolean;
  selected: "wm" | "stamp" | null;
  fontFamily: string;
  onSelect: (zone: "wm" | "stamp") => void;
  onChange: (value: ReportLayout) => void;
}) {
  const height = (width * pageHeight) / pageWidth;
  const scale = width / pageWidth;
  const mark = layout.watermarkStyle ?? defaultReportMark();
  const stamp = layout.stampStyle ?? { color: "#059669", opacity: 90, pages: "ALL" as const, font: "NOTO_SANS" as const };

  const watermarkNode = useRef<Konva.Text>(null);
  const watermarkTransformer = useRef<Konva.Transformer>(null);
  const stampNode = useRef<Konva.Group>(null);
  const stampTransformer = useRef<Konva.Transformer>(null);

  const stampWidthPercent = stamp.width ?? clamp(layout.stamp.length * 1.4 + 6, 10, 40);
  const stampBoxWidth = (stampWidthPercent / 100) * width;
  const stampBoxHeight = Math.max(18 * scale, stampBoxWidth * 0.28);
  const stampLeft = stamp.x != null && stamp.y != null ? stamp.x : 100 - stampWidthPercent - 4;
  const stampTop = stamp.x != null && stamp.y != null ? stamp.y : DEFAULT_STAMP_Y;

  useEffect(() => {
    watermarkTransformer.current?.nodes(selected === "wm" && watermarkNode.current ? [watermarkNode.current] : []);
    watermarkTransformer.current?.getLayer()?.batchDraw();
    stampTransformer.current?.nodes(selected === "stamp" && stampNode.current ? [stampNode.current] : []);
    stampTransformer.current?.getLayer()?.batchDraw();
  }, [selected, watermarkShown, stampShown, layout.watermark, layout.stamp, width]);

  const watermarkFontPx = mark.fontSize * scale;
  const commitWatermark = (patch: Partial<typeof mark>) => onChange({ ...layout, watermarkStyle: { ...mark, ...patch } });
  const commitStamp = (patch: Partial<NonNullable<ReportLayout["stampStyle"]>>) => onChange({ ...layout, stampStyle: { ...stamp, ...patch } });

  return (
    <div style={{ position: "absolute", inset: 0 }} data-testid="mark-overlay">
      <Stage width={width} height={height}>
        <Layer>
          {watermarkShown && (
            <Text
              ref={watermarkNode}
              text={layout.watermark}
              x={(mark.x / 100) * width}
              y={(mark.y / 100) * height}
              lineHeight={1}
              offsetY={watermarkFontPx}
              rotation={-mark.rotation}
              fontSize={watermarkFontPx}
              fontStyle="bold"
              fontFamily={fontFamily}
              fill={mark.color}
              opacity={mark.opacity / 100}
              draggable
              onClick={() => onSelect("wm")}
              onTap={() => onSelect("wm")}
              onDragStart={() => onSelect("wm")}
              onDragEnd={(event) => commitWatermark({ x: round(clamp((event.target.x() / width) * 100, 0, 95)), y: round(clamp((event.target.y() / height) * 100, 0, 98)) })}
              onTransformEnd={() => {
                const node = watermarkNode.current;
                if (!node) return;
                const factor = (node.scaleX() + node.scaleY()) / 2;
                node.scaleX(1);
                node.scaleY(1);
                commitWatermark({
                  x: round(clamp((node.x() / width) * 100, 0, 95)),
                  y: round(clamp((node.y() / height) * 100, 0, 98)),
                  fontSize: Math.round(clamp(mark.fontSize * factor, 6, 96)),
                  rotation: Math.round(normalizeAngle(-node.rotation())),
                });
              }}
            />
          )}
          {watermarkShown && selected === "wm" && (
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

          {stampShown && (
            <Group
              ref={stampNode}
              x={(stampLeft / 100) * width}
              y={(stampTop / 100) * height}
              opacity={stamp.opacity / 100}
              draggable
              dragBoundFunc={(position) => ({ x: clamp(position.x, 0, width - stampBoxWidth), y: clamp(position.y, 0, height - stampBoxHeight) })}
              onClick={() => onSelect("stamp")}
              onTap={() => onSelect("stamp")}
              onDragStart={() => onSelect("stamp")}
              onDragEnd={(event) => commitStamp({ x: round((event.target.x() / width) * 100), y: round((event.target.y() / height) * 100) })}
              onTransformEnd={() => {
                const node = stampNode.current;
                if (!node) return;
                const scaleX = node.scaleX();
                node.scaleX(1);
                node.scaleY(1);
                commitStamp({
                  x: round(clamp((node.x() / width) * 100, 0, 100)),
                  y: round(clamp((node.y() / height) * 100, 0, 100)),
                  width: Math.round(clamp(stampWidthPercent * scaleX, 5, 60)),
                });
              }}
            >
              <Rect width={stampBoxWidth} height={stampBoxHeight} stroke={stamp.color} strokeWidth={Math.max(1, 1.5 * scale)} cornerRadius={3 * scale} fill="rgba(255,255,255,0.6)" />
              <Text
                width={stampBoxWidth}
                height={stampBoxHeight}
                text={layout.stamp}
                align="center"
                verticalAlign="middle"
                fontStyle="bold"
                fontFamily={fontFamily}
                fontSize={Math.max(6, stampBoxHeight * 0.42)}
                fill={stamp.color}
              />
            </Group>
          )}
          {stampShown && selected === "stamp" && (
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
        </Layer>
      </Stage>
    </div>
  );
}
