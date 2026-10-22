import { useCallback, useEffect, useRef, useState } from "react";
import { IconCamera, IconCameraOff } from "@tabler/icons-react";
import jsQR from "jsqr";
import { Button } from "@/components/ui/button/Button";
import { OtpInput } from "@/components/ui/otp-input/OtpInput";
import { FormModal } from "@/components/ui/modal/FormModal";
import { useToast } from "@/components/ui/toast/Toast";
import { trainingCheckInApi, trainingError } from "@/services/api/trainingActivities";

/** The six digits in what a QR code holds: the whole address of the check-in page, or the digits alone. */
export const codeFromScan = (text: string): string | undefined => {
  try {
    const fromAddress = new URL(text).searchParams.get("code");
    if (fromAddress && /^\d{6}$/.test(fromAddress)) return fromAddress;
  } catch { /* not an address */ }
  return /^\d{6}$/.test(text.trim()) ? text.trim() : undefined;
};

type Detector = { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> };

/**
 * Reads QR codes from the camera. The browser's own detector is used when there is one (Chrome, Edge, Android); otherwise the frames are decoded here with jsQR, so it works in
 * every browser that can open a camera. The camera needs a secure address (https, or localhost) and stops as soon as a code is read or the screen is closed.
 */
function CameraScanner({ onCode, onError }: { onCode: (code: string) => void; onError: (message: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | undefined;
    let timer = 0;
    const canvas = document.createElement("canvas");
    const Native = (window as unknown as { BarcodeDetector?: new (options: { formats: string[] }) => Detector }).BarcodeDetector;
    const detector = Native ? new Native({ formats: ["qr_code"] }) : undefined;

    const found = (text: string) => {
      const code = codeFromScan(text);
      if (!code || stopped) return false;
      stopped = true;
      onCodeRef.current(code);
      return true;
    };
    const tick = async () => {
      const el = video.current;
      if (stopped || !el) return;
      if (el.readyState >= 2 && el.videoWidth > 0) {
        try {
          if (detector) {
            const hits = await detector.detect(el);
            if (hits.some((h) => found(h.rawValue))) return;
          } else {
            canvas.width = el.videoWidth;
            canvas.height = el.videoHeight;
            const context = canvas.getContext("2d", { willReadFrequently: true });
            if (context) {
              context.drawImage(el, 0, 0);
              const image = context.getImageData(0, 0, canvas.width, canvas.height);
              const hit = jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" });
              if (hit && found(hit.data)) return;
            }
          }
        } catch { /* a frame that cannot be read is skipped */ }
      }
      timer = window.setTimeout(() => void tick(), 150);
    };

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        onErrorRef.current("This browser cannot open the camera here. The camera needs a secure address (https). Type the code instead.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }
        if (video.current) {
          video.current.srcObject = stream;
          await video.current.play().catch(() => undefined);
        }
        void tick();
      } catch (e) {
        const name = (e as { name?: string }).name;
        onErrorRef.current(name === "NotAllowedError" ? "The camera is blocked. Allow it for this site in the browser, or type the code." : name === "NotFoundError" ? "No camera was found on this device. Type the code." : "The camera could not be opened. Type the code.");
      }
    })();

    return () => {
      stopped = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-900">
      <video ref={video} className="aspect-square w-full object-cover" playsInline muted aria-label="Camera view for the QR code" />
    </div>
  );
}

/**
 * A trainee confirms being in the room: the QR code is scanned with the camera of the device, or the six digits shown by the trainer are typed. Clear empties the code and closes the dialog;
 * Confirm records the attendance (the person is already signed in, so there is no second signature). The QR code carries the address of this screen with the code in it, so a scan with the
 * camera app of a phone opens it filled in as well.
 */
export function CheckInDialog({ isOpen, initialCode = "", onClose, onDone }: { isOpen: boolean; initialCode?: string; onClose: () => void; onDone: (result: { activityId: string; trainingNumber: string }) => void }) {
  const { showToast } = useToast();
  const [code, setCode] = useState(initialCode.replace(/\D/g, "").slice(0, 6));
  const [camera, setCamera] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCode(initialCode.replace(/\D/g, "").slice(0, 6));
      setCamera(false);
      setCameraError("");
    }
  }, [isOpen, initialCode]);

  const confirm = useCallback(async (value: string) => {
    setBusy(true);
    try {
      const result = await trainingCheckInApi.checkIn({ code: value });
      showToast({ type: "success", title: "Attendance recorded", message: result.trainingNumber });
      onDone(result);
    } catch (e) {
      showToast({ type: "error", title: "Check-in failed", message: trainingError(e) });
    } finally {
      setBusy(false);
    }
  }, [onDone, showToast]);
  // A code read by the camera is confirmed at once: nothing else is left to type.
  const scanned = useCallback((value: string) => {
    setCode(value);
    setCamera(false);
    void confirm(value);
  }, [confirm]);
  const clear = () => { setCode(""); setCamera(false); setCameraError(""); onClose(); };
  if (!isOpen) return null;

  return (
    <FormModal isOpen onClose={clear} onConfirm={() => void confirm(code)} title="Check in" description="Scan the QR code the trainer shows, or type the six-digit code." confirmText="Confirm" cancelText="Clear" confirmDisabled={code.length !== 6 || busy} isLoading={busy} size="md">
      <div className="space-y-4">
        {camera ? (
          <>
            <CameraScanner onCode={scanned} onError={(message) => { setCamera(false); setCameraError(message); }} />
            <p className="text-center text-xs text-slate-500">Point the camera at the QR code on the trainer screen.</p>
            <Button variant="outline" className="w-full" onClick={() => setCamera(false)}><IconCameraOff className="mr-2 h-4 w-4" />Stop the camera</Button>
          </>
        ) : (
          <Button variant="outline-emerald" className="w-full" onClick={() => { setCameraError(""); setCamera(true); }}><IconCamera className="mr-2 h-4 w-4" />Scan the QR code with the camera</Button>
        )}
        {cameraError && <p role="alert" className="text-sm text-red-700">{cameraError}</p>}
        <div className="space-y-2">
          <div className="text-center text-sm font-medium text-slate-700">Or type the code</div>
          <OtpInput value={code} onChange={setCode} disabled={busy} autoFocus ariaLabel="Check-in code digit" />
        </div>
      </div>
    </FormModal>
  );
}
