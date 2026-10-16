import { useEffect, useRef } from "react";
import type Konva from "konva";
import { Group, Rect, Text, Transformer } from "react-konva";

/** Fractions of the page (0..1, left to right and top down). */
export interface StampBoxState {
  left: number;
  top: number;
  width: number;
  height: number;
}

const round = (value: number) => Math.round(value * 10000) / 10000;

/**
 * The frame of the stamp on the preview: the server draws the stamp into the page and says where it put it; this draws a blue frame over it that can be
 * dragged and resized with its corner handles. The height follows the width (the stamp scales as a whole), so only the left, top and width are kept.
 */
export function ReportStampBox({
  box,
  stageWidth,
  stageHeight,
  onChange,
  onBox,
}: {
  box: StampBoxState;
  stageWidth: number;
  stageHeight: number;
  /** The new left and top edge as a percentage of the page, and the width when it was resized (a stamp that is only moved keeps its size). */
  onChange: (placement: { x: number; y: number; width?: number }) => void;
  onBox: (box: StampBoxState) => void;
}) {
  const node = useRef<Konva.Group>(null);
  const transformer = useRef<Konva.Transformer>(null);
  useEffect(() => {
    transformer.current?.nodes(node.current ? [node.current] : []);
    transformer.current?.getLayer()?.batchDraw();
  }, [box]);

  const commit = (next: StampBoxState, resized: boolean) => {
    onBox(next);
    onChange({ x: round(next.left * 100), y: round(next.top * 100), ...(resized ? { width: round(next.width * 100) } : {}) });
  };
  return (
    <>
      <Group
        ref={node}
        x={box.left * stageWidth}
        y={box.top * stageHeight}
        draggable
        dragBoundFunc={(pos) => ({
          x: Math.max(0, Math.min(pos.x, stageWidth - box.width * stageWidth)),
          y: Math.max(0, Math.min(pos.y, stageHeight - box.height * stageHeight)),
        })}
        onDragEnd={() => {
          const current = node.current;
          if (current) commit({ ...box, left: current.x() / stageWidth, top: current.y() / stageHeight }, false);
        }}
        onTransformEnd={() => {
          const current = node.current;
          if (!current) return;
          const scaleX = current.scaleX();
          const scaleY = current.scaleY();
          current.scaleX(1);
          current.scaleY(1);
          commit({
            left: current.x() / stageWidth,
            top: current.y() / stageHeight,
            width: Math.min(0.6, Math.max(0.05, box.width * scaleX)),
            height: box.height * scaleY,
          }, true);
        }}
      >
        <Rect width={box.width * stageWidth} height={box.height * stageHeight} stroke="#0284c7" strokeWidth={2} fill="#0284c71a" />
        <Text
          width={box.width * stageWidth}
          height={box.height * stageHeight}
          text="STAMP"
          align="center"
          verticalAlign="middle"
          fontStyle="bold"
          fontSize={12}
          fill="#0284c7"
        />
      </Group>
      <Transformer
        ref={transformer}
        rotateEnabled={false}
        keepRatio={false}
        enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right"]}
        borderStroke="#0284c7"
        anchorStroke="#0284c7"
        anchorFill="#ffffff"
        boundBoxFunc={(oldBox, newBox) => (newBox.width < 30 || newBox.height < 16 ? oldBox : newBox)}
      />
    </>
  );
}
