import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Clock, Download, Eye, EyeOff, FileWarning, Lock, Printer } from "lucide-react";
import { Button } from "@/components/ui/button/Button";
import { FullPageLoading } from "@/components/ui/loading/Loading";
import { DocumentPdfViewer } from "@/features/documents/shared/components/DocumentPdfViewer";
import { documentApi } from "@/services/api/documents";
import { ROUTES } from "@/app/routes.constants";
import { navigateBack } from "@/app/navigation/backNavigation";
import { useAuth } from "@/contexts/AuthContext";
import logo from "@/assets/images/logo_nobg.png";
import type { ControlledCopyRouteState } from "./controlledCopyNavigation";

type PreviewManifest = {
  id: string;
  controlledCopyNumber: string;
  documentTitle: string;
  documentNumber: string;
  revisionNumber: string;
  recipientName?: string;
  pageCount: number;
  token: string;
  allowDownload: boolean;
  allowPrint: boolean;
  downloadOnce?: boolean;
  printOnce?: boolean;
  expiryDate?: string | null;
};

const buildWatermarkDataUri = (lines: string[]) => {
  const escape = (value: string) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const tileWidth = 460;
  const tileHeight = 260;
  const text = lines
    .map((line, index) => `<tspan x="0" dy="${index === 0 ? 0 : 18}">${escape(line)}</tspan>`)
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${tileWidth}" height="${tileHeight}">
    <text x="20" y="${tileHeight / 2}" font-size="13" font-family="sans-serif" fill="rgba(15,23,42,0.09)" transform="rotate(-28 ${tileWidth / 2} ${tileHeight / 2})">${text}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

export const ControlledCopyPreviewView: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id = "" } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || new URLSearchParams(location.hash.replace(/^#/, "")).get("token") || "";
  const { isAuthenticated } = useAuth();
  const startedAtRef = useRef<number>(Date.now());
  const navigationState = (location.state as ControlledCopyRouteState | null) || null;
  const handleBack = () => navigateBack(navigate, navigationState, ROUTES.DOCUMENTS.CONTROLLED_COPIES.ALL);

  const [manifest, setManifest] = useState<PreviewManifest | null>(null);
  const [manifestError, setManifestError] = useState<string | null>(null);

  // The backend exchanges the e-mail token + password for a short-lived
  // preview grant.  Keep only that grant after the initial verification.
  const [previewGrant, setPreviewGrant] = useState<string | null>(null);
  const [passwordInput, setPasswordInput] = useState("");
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [passwordSubmitError, setPasswordSubmitError] = useState<string | null>(null);
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isLoadingFile, setIsLoadingFile] = useState(true);
  const [fileError, setFileError] = useState(false);
  const [openedAt] = useState(() => new Date());

  const allowDownload = manifest?.allowDownload ?? false;
  const allowPrint = manifest?.allowPrint ?? false;
  const downloadOnce = manifest?.downloadOnce ?? false;
  const printOnce = manifest?.printOnce ?? false;
  const [isActionRunning, setIsActionRunning] = useState(false);

  const downloadOnceFromServer = async () => {
    if (!id || !previewGrant || isActionRunning) return;
    setIsActionRunning(true);
    try {
      const blob = await documentApi.downloadControlledCopy(id, previewGrant);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${manifest?.controlledCopyNumber || "controlled-copy"}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      setManifest((current) => current ? { ...current, allowDownload: false } : current);
    } finally {
      setIsActionRunning(false);
    }
  };

  const printOnceFromServer = async () => {
    if (!id || !previewGrant || isActionRunning) return;
    setIsActionRunning(true);
    try {
      await documentApi.consumeControlledCopyPreviewPrint(id, previewGrant);
      window.print();
      setManifest((current) => current ? { ...current, allowPrint: false } : current);
    } finally {
      setIsActionRunning(false);
    }
  };

  const watermarkUrl = useMemo(() => {
    const who = manifest?.recipientName || "Controlled recipient";
    const stamp = openedAt.toLocaleString();
    return buildWatermarkDataUri([who, stamp]);
  }, [manifest?.recipientName, openedAt]);

  useEffect(() => {
    document.title = manifest?.documentTitle ? `${manifest.documentTitle} — Controlled Copy` : "Controlled Copy Preview";
  }, [manifest?.documentTitle]);

  // The password modal is required before anything opens — nothing is fetched until the user
  // submits it. A copy issued before this feature has no password stored, in which case the
  // backend accepts any (including blank) password, so submitting the form once is still enough.
  useEffect(() => {
    if (!id || !token) {
      setManifestError("Access token is required.");
      return;
    }
    setShowPasswordInput(true);
  }, [id, token]);

  const handlePasswordSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!id || !token) return;
    setIsSubmittingPassword(true);
    setPasswordSubmitError(null);
    try {
      const response = await documentApi.openControlledCopyPreview(id, token, passwordInput.trim());
      setManifest(response as PreviewManifest);
      setPreviewGrant((response as PreviewManifest).token);
      window.history.replaceState(null, "", `${location.pathname}${location.search}`);
      setShowPasswordInput(false);
    } catch (err: any) {
      setPasswordSubmitError(
        err?.response?.data?.message || "Incorrect password. Please check the distribution email and try again.",
      );
    } finally {
      setIsSubmittingPassword(false);
    }
  };

  // Load the full PDF for the embedded viewer once the manifest + password are both confirmed valid.
  useEffect(() => {
    if (!manifest || !id || !token || previewGrant === null) return;
    let active = true;
    setIsLoadingFile(true);
    setFileError(false);
    documentApi
      .getControlledCopyPreviewFile(id, previewGrant)
      .then((blob) => {
        if (!active) return;
        setBlobUrl(URL.createObjectURL(blob));
      })
      .catch(() => {
        if (active) setFileError(true);
      })
      .finally(() => {
        if (active) setIsLoadingFile(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manifest?.id, id, previewGrant]);

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  useEffect(() => {
    const handleContextMenu = (event: MouseEvent) => {
      if (!allowDownload && !allowPrint) event.preventDefault();
    };
    document.addEventListener("contextmenu", handleContextMenu);
    return () => document.removeEventListener("contextmenu", handleContextMenu);
  }, [allowDownload, allowPrint]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const blocked = (key === "p" && !allowPrint) || (key === "s" && !allowDownload) || ["c", "a"].includes(key);
      if ((event.ctrlKey || event.metaKey) && blocked) {
        event.preventDefault();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [allowDownload, allowPrint]);

  // Record the viewing session (open→close duration) for audit purposes.
  useEffect(() => {
    const close = () => {
      if (!manifest?.id || !token) return;
      const spent = Math.max(Date.now() - startedAtRef.current, 0);
      void documentApi.closeControlledCopyPreview(manifest.id, previewGrant || "", spent);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") close();
    };
    window.addEventListener("pagehide", close);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      close();
      window.removeEventListener("pagehide", close);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [manifest?.id, previewGrant]);

  if (manifestError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-white border border-slate-200 rounded-xl shadow-sm p-6 text-center space-y-4">
          <div className="mx-auto h-12 w-12 rounded-full bg-rose-50 flex items-center justify-center">
            <Lock className="h-6 w-6 text-rose-600" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Access Denied</h1>
            <p className="text-sm text-slate-600 mt-2">{manifestError}</p>
          </div>
          {isAuthenticated && (
            <Button variant="outline-emerald" onClick={handleBack}>
              Back
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (showPasswordInput || !manifest) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <form
          onSubmit={(event) => void handlePasswordSubmit(event)}
          className="max-w-md w-full bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-4"
        >
          <div className="mx-auto h-12 w-12 rounded-full bg-emerald-50 flex items-center justify-center">
            <Lock className="h-6 w-6 text-emerald-600" />
          </div>
          <div className="text-center">
            <h1 className="text-lg font-semibold text-slate-900">Password Required</h1>
            <p className="text-sm text-slate-600 mt-2">
              Enter the preview password from the distribution email to open this controlled copy.
            </p>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="preview-password" className="text-xs font-medium text-slate-700">
              Preview Password
            </label>
            <div className="relative">
              <input
                id="preview-password"
                type={showPassword ? "text" : "password"}
                autoFocus
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  setPasswordSubmitError(null);
                }}
                placeholder="Enter password..."
                className="w-full h-10 px-3 pr-10 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {passwordSubmitError && (
              <p className="text-xs text-rose-600">{passwordSubmitError}</p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={isSubmittingPassword || !passwordInput.trim()}>
            {isSubmittingPassword ? "Verifying..." : "Open Preview"}
          </Button>
        </form>
      </div>
    );
  }

  const subtitle = [
    manifest.documentNumber,
    manifest.revisionNumber && `Rev ${manifest.revisionNumber}`,
    manifest.controlledCopyNumber,
  ]
    .filter(Boolean)
    .join(" · ");

  const expiryDate = manifest.expiryDate ? new Date(manifest.expiryDate) : null;
  const isExpired = expiryDate ? expiryDate.getTime() <= Date.now() : false;

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-50">
      <div className="relative shrink-0 border-b border-slate-200 bg-white px-3 md:px-6 py-2.5 md:py-3 flex items-center justify-between gap-2 md:gap-4">
        <img
          src={logo}
          alt="Ngoc Thien"
          className="hidden sm:block h-7 md:h-8 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        />
        <div className="relative z-10 min-w-0 flex items-center gap-2 md:gap-3 max-w-[55%] sm:max-w-[38%]">
          <div className="h-8 w-8 md:h-9 md:w-9 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
            <Lock className="h-4 w-4 md:h-4.5 md:w-4.5 text-emerald-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs md:text-sm font-semibold text-slate-900 truncate">{manifest.documentTitle}</p>
            <p className="text-2xs md:text-xs text-slate-500 truncate">{subtitle}</p>
          </div>
        </div>
        <div className="relative z-10 flex items-center gap-2 shrink-0">
          {expiryDate && (
            <div
              className={`hidden md:flex items-center gap-1.5 text-2xs md:text-xs px-2.5 py-1 rounded-full ${
                isExpired ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              {isExpired ? "Expired" : "Expires"} {expiryDate.toLocaleString()}
            </div>
          )}
          {downloadOnce && allowDownload && (
            <Button variant="outline-emerald" size="sm" onClick={() => void downloadOnceFromServer()} disabled={isActionRunning}>
              <Download className="h-4 w-4 mr-1.5" /> Download
            </Button>
          )}
          {printOnce && allowPrint && (
            <Button variant="outline-emerald" size="sm" onClick={() => void printOnceFromServer()} disabled={isActionRunning}>
              <Printer className="h-4 w-4 mr-1.5" /> Print
            </Button>
          )}
          {isAuthenticated && (
            <Button variant="outline-emerald" size="sm" onClick={handleBack}>
              Back
            </Button>
          )}
        </div>
      </div>

      <div className="relative flex-1 min-h-0">
        {fileError || (!isLoadingFile && !blobUrl) ? (
          <div className="h-full flex flex-col items-center justify-center gap-3">
            <FileWarning className="h-10 w-10 text-red-300" />
            <p className="text-sm font-medium text-red-500">Unable to load this controlled copy's preview</p>
          </div>
        ) : isLoadingFile || !blobUrl ? (
          <FullPageLoading text="Loading preview..." />
        ) : (
          <DocumentPdfViewer
            fileUrl={blobUrl}
            withFrame={false}
            allowDownload={downloadOnce ? false : allowDownload}
            allowPrint={printOnce ? false : allowPrint}
            allowContextMenu={(downloadOnce ? false : allowDownload) || (printOnce ? false : allowPrint)}
          />
        )}
        {blobUrl && !isLoadingFile && (
          <div
            className="pointer-events-none absolute inset-0 z-10"
            style={{ backgroundImage: `url("${watermarkUrl}")`, backgroundRepeat: "repeat" }}
          />
        )}
      </div>
    </div>
  );
};
