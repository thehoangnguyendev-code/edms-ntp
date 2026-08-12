import React, {
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ZoomIn, ZoomOut, RotateCcw, Check } from 'lucide-react';
import { Button } from '@/components/ui/button/Button';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AvatarCropModalProps {
    /** Raw image src (object URL or data URL) to crop */
    imageSrc: string;
    isOpen: boolean;
    onClose: () => void;
    /** Called with the cropped image as a Blob */
    onCropComplete: (croppedBlob: Blob) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CANVAS_SIZE = 320;       // display canvas px
const OUTPUT_SIZE = 256;       // exported image px
const MIN_ZOOM = 0.8;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.1;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const AvatarCropModal: React.FC<AvatarCropModalProps> = ({
    imageSrc,
    isOpen,
    onClose,
    onCropComplete,
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imageRef = useRef<HTMLImageElement | null>(null);

    // Image natural dimensions
    const [imgSize, setImgSize] = useState({ w: 0, h: 0 });

    // Pan offset (canvas-space, relative to canvas centre)
    const [offset, setOffset] = useState({ x: 0, y: 0 });

    // Zoom level (1 = fit-to-canvas)
    const [zoom, setZoom] = useState(1);
    const [minZoom, setMinZoom] = useState(0.1);
    const [maxZoom, setMaxZoom] = useState(4);

    // Drag state
    const dragging = useRef(false);
    const lastPointer = useRef({ x: 0, y: 0 });

    // -----------------------------------------------------------------------
    // Load image
    // -----------------------------------------------------------------------

    useEffect(() => {
        if (!isOpen || !imageSrc) return;

        const img = new Image();
        img.onload = () => {
            imageRef.current = img;
            setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
            setOffset({ x: 0, y: 0 });
            // Initial zoom: fit shortest side to canvas circle
            const fitZoom = CANVAS_SIZE / Math.min(img.naturalWidth, img.naturalHeight);
            setMinZoom(fitZoom);
            setMaxZoom(fitZoom * 5);
            setZoom(fitZoom);
        };
        img.src = imageSrc;
    }, [imageSrc, isOpen]);

    // -----------------------------------------------------------------------
    // Draw
    // -----------------------------------------------------------------------

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        const img = imageRef.current;
        if (!canvas || !img || imgSize.w === 0) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

        // --- Draw image (centred + offset + zoomed) ---
        const scaledW = imgSize.w * zoom;
        const scaledH = imgSize.h * zoom;
        const dx = (CANVAS_SIZE - scaledW) / 2 + offset.x;
        const dy = (CANVAS_SIZE - scaledH) / 2 + offset.y;

        ctx.drawImage(img, dx, dy, scaledW, scaledH);

        // --- Overlay (darken area outside circle) ---
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.52)';
        ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

        // Cut out the circle (composite: destination-out punches a hole)
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, CANVAS_SIZE / 2 - 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // --- Redraw image clipped to circle so we see the content ---
        ctx.save();
        ctx.beginPath();
        ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, CANVAS_SIZE / 2 - 1, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(img, dx, dy, scaledW, scaledH);

        // --- Rule-of-thirds grid (clipped inside circle) ---
        ctx.strokeStyle = 'rgba(255,255,255,0.22)';
        ctx.lineWidth = 1;
        ctx.setLineDash([]);

        // 2 vertical lines at 1/3 and 2/3
        for (let i = 1; i <= 2; i++) {
            const x = (CANVAS_SIZE / 3) * i;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, CANVAS_SIZE);
            ctx.stroke();
        }
        // 2 horizontal lines at 1/3 and 2/3
        for (let i = 1; i <= 2; i++) {
            const y = (CANVAS_SIZE / 3) * i;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(CANVAS_SIZE, y);
            ctx.stroke();
        }

        // --- Centre crosshair ---
        const cx = CANVAS_SIZE / 2;
        const cy = CANVAS_SIZE / 2;
        const crossLen = 10;
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 1;
        // horizontal arm
        ctx.beginPath();
        ctx.moveTo(cx - crossLen, cy);
        ctx.lineTo(cx + crossLen, cy);
        ctx.stroke();
        // vertical arm
        ctx.beginPath();
        ctx.moveTo(cx, cy - crossLen);
        ctx.lineTo(cx, cy + crossLen);
        ctx.stroke();

        ctx.restore();

        // --- Circle border ---
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, CANVAS_SIZE / 2 - 1, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }, [imgSize, zoom, offset]);

    useEffect(() => {
        draw();
    }, [draw]);

    // -----------------------------------------------------------------------
    // Clamp offset so image always covers the circle
    // -----------------------------------------------------------------------

    const clampOffset = useCallback((dx: number, dy: number, currentZoom: number) => {
        if (imgSize.w === 0) return { x: dx, y: dy };

        const scaledW = imgSize.w * currentZoom;
        const scaledH = imgSize.h * currentZoom;

        // Max pan = how much the scaled image extends beyond the canvas edge
        const maxX = Math.max(0, (scaledW - CANVAS_SIZE) / 2);
        const maxY = Math.max(0, (scaledH - CANVAS_SIZE) / 2);

        return {
            x: clamp(dx, -maxX, maxX),
            y: clamp(dy, -maxY, maxY),
        };
    }, [imgSize]);

    // -----------------------------------------------------------------------
    // Mouse events
    // -----------------------------------------------------------------------

    const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        dragging.current = true;
        lastPointer.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!dragging.current) return;
        const dx = e.clientX - lastPointer.current.x;
        const dy = e.clientY - lastPointer.current.y;
        lastPointer.current = { x: e.clientX, y: e.clientY };
        setOffset(prev => clampOffset(prev.x + dx, prev.y + dy, zoom));
    };

    const onMouseUp = () => { dragging.current = false; };

    const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
        setZoom(prev => {
            const next = clamp(prev + delta, minZoom, maxZoom);
            setOffset(o => clampOffset(o.x, o.y, next));
            return next;
        });
    };

    // -----------------------------------------------------------------------
    // Touch events
    // -----------------------------------------------------------------------

    const lastTouchDist = useRef<number | null>(null);

    const onTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
        if (e.touches.length === 1) {
            dragging.current = true;
            lastPointer.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
        if (e.touches.length === 2) {
            lastTouchDist.current = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
        }
    };

    const onTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        if (e.touches.length === 1 && dragging.current) {
            const dx = e.touches[0].clientX - lastPointer.current.x;
            const dy = e.touches[0].clientY - lastPointer.current.y;
            lastPointer.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            setOffset(prev => clampOffset(prev.x + dx, prev.y + dy, zoom));
        }
        if (e.touches.length === 2 && lastTouchDist.current !== null) {
            const dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            const ratio = dist / lastTouchDist.current;
            lastTouchDist.current = dist;
            setZoom(prev => {
                const next = clamp(prev * ratio, minZoom, maxZoom);
                setOffset(o => clampOffset(o.x, o.y, next));
                return next;
            });
        }
    };

    const onTouchEnd = () => {
        dragging.current = false;
        lastTouchDist.current = null;
    };

    // -----------------------------------------------------------------------
    // Zoom controls
    // -----------------------------------------------------------------------

    const zoomIn = () => setZoom(prev => {
        const next = clamp(prev + ZOOM_STEP * 2, minZoom, maxZoom);
        setOffset(o => clampOffset(o.x, o.y, next));
        return next;
    });

    const zoomOut = () => setZoom(prev => {
        const next = clamp(prev - ZOOM_STEP * 2, minZoom, maxZoom);
        setOffset(o => clampOffset(o.x, o.y, next));
        return next;
    });

    const resetView = () => {
        const fitZoom = CANVAS_SIZE / Math.min(imgSize.w, imgSize.h);
        setZoom(fitZoom);
        setOffset({ x: 0, y: 0 });
    };

    // -----------------------------------------------------------------------
    // Export cropped image
    // -----------------------------------------------------------------------

    const handleCrop = () => {
        const img = imageRef.current;
        if (!img || imgSize.w === 0) return;

        // Off-screen canvas at OUTPUT_SIZE
        const off = document.createElement('canvas');
        off.width = OUTPUT_SIZE;
        off.height = OUTPUT_SIZE;
        const ctx = off.getContext('2d');
        if (!ctx) return;

        const scale = OUTPUT_SIZE / CANVAS_SIZE;

        // Clip to circle
        ctx.beginPath();
        ctx.arc(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, 0, Math.PI * 2);
        ctx.clip();

        const scaledW = imgSize.w * zoom * scale;
        const scaledH = imgSize.h * zoom * scale;
        const dx = (OUTPUT_SIZE - scaledW) / 2 + offset.x * scale;
        const dy = (OUTPUT_SIZE - scaledH) / 2 + offset.y * scale;

        ctx.drawImage(img, dx, dy, scaledW, scaledH);

        off.toBlob(blob => {
            if (blob) onCropComplete(blob);
        }, 'image/jpeg', 0.92);
    };

    // -----------------------------------------------------------------------
    // Keyboard ESC to close
    // -----------------------------------------------------------------------

    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [isOpen, onClose]);

    // -----------------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------------

    return createPortal(
        <AnimatePresence mode="wait">
            {isOpen && (
                <motion.div
                    key="avatar-crop-wrapper"
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                >
                    {/* Backdrop */}
                    <motion.div
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                        onClick={onClose}
                    />

                    {/* Modal — matches FormModal design */}
                    <motion.div
                        role="dialog"
                        aria-modal="true"
                        aria-label="Crop avatar"
                        initial={{ opacity: 0, scale: 0.95, y: 16 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 12 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 350, duration: 0.3 }}
                        className="relative z-10 bg-white/95 backdrop-blur-md rounded-xl w-full max-w-sm border border-slate-200 overflow-hidden flex flex-col"
                        style={{ maxHeight: 'calc(100dvh - 2rem)' }}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header — FormModal style */}
                        <div className="px-4 sm:px-6 py-2.5 sm:py-3 border-b border-slate-200 bg-white shrink-0">
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-sm sm:text-base font-semibold text-slate-900 leading-tight">Crop Avatar</h3>
                                </div>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex-shrink-0 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                                    aria-label="Close"
                                >
                                    <X className="h-4 w-4 text-slate-500" />
                                </button>
                            </div>
                        </div>

                        {/* Body — FormModal style */}
                        <div className="px-4 sm:px-6 py-4 sm:py-5 bg-white overflow-y-auto flex-1 min-h-0 flex flex-col items-center gap-4">
                            {/* Canvas wrapper */}
                            <div
                                className="rounded-full ring-2 ring-emerald-500/30 ring-offset-2 shadow-lg overflow-hidden w-[280px] h-[280px] xs:w-[300px] xs:h-[300px] sm:w-[320px] sm:h-[320px]"
                            >
                                <canvas
                                    ref={canvasRef}
                                    width={CANVAS_SIZE}
                                    height={CANVAS_SIZE}
                                    className="cursor-grab active:cursor-grabbing touch-none select-none block w-full h-full"
                                    onMouseDown={onMouseDown}
                                    onMouseMove={onMouseMove}
                                    onMouseUp={onMouseUp}
                                    onMouseLeave={onMouseUp}
                                    onWheel={onWheel}
                                    onTouchStart={onTouchStart}
                                    onTouchMove={onTouchMove}
                                    onTouchEnd={onTouchEnd}
                                />
                            </div>

                            {/* Zoom controls */}
                            <div className="flex items-center gap-3 w-full px-1">
                                <button
                                    type="button"
                                    onClick={zoomOut}
                                    disabled={zoom <= minZoom}
                                    className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                    aria-label="Zoom out"
                                >
                                    <ZoomOut className="h-4 w-4" />
                                </button>

                                {/* Zoom slider */}
                                <input
                                    type="range"
                                    min={minZoom}
                                    max={maxZoom}
                                    step={0.01}
                                    value={zoom}
                                    onChange={e => {
                                        const next = parseFloat(e.target.value);
                                        setZoom(next);
                                        setOffset(o => clampOffset(o.x, o.y, next));
                                    }}
                                    className="flex-1 h-1.5 rounded-full accent-emerald-600 cursor-pointer"
                                    aria-label="Zoom level"
                                />

                                <button
                                    type="button"
                                    onClick={zoomIn}
                                    disabled={zoom >= maxZoom}
                                    className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                    aria-label="Zoom in"
                                >
                                    <ZoomIn className="h-4 w-4" />
                                </button>

                                <button
                                    type="button"
                                    onClick={resetView}
                                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
                                    aria-label="Reset view"
                                    title="Reset view"
                                >
                                    <RotateCcw className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        {/* Footer — FormModal style, buttons right-aligned */}
                        <div className="px-4 sm:px-6 py-3 sm:py-4 bg-slate-50/50 border-t border-slate-200 flex justify-end items-center gap-2 sm:gap-3 shrink-0">
                            <Button size="sm" variant="outline" onClick={onClose}>
                                Cancel
                            </Button>
                            <Button
                                size="sm"
                                variant="default"
                                onClick={handleCrop}
                                className="gap-1.5"
                            >
                                Use this crop
                            </Button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
};
