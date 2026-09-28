import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Book, BookmarkCheck, BookOpenCheck, ChevronDown, Layers3, Pencil, RefreshCw, Wand2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button";
import { FormSection } from "@/components/ui/form/FormSection";
import { Input, Textarea } from "@/components/ui/form/ResponsiveForm";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { FullPageLoading, Loading } from "@/components/ui/loading";
import { DocumentPdfViewer } from "@/features/documents/shared/components/DocumentPdfViewer";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { useToast } from "@/components/ui/toast";
import { useNavigateWithLoading } from "@/hooks/useNavigateWithLoading";
import { useRevisionActionCapabilities } from "@/hooks/useRevisionActionCapabilities";
import { ROUTES } from "@/app/routes.constants";
import { publishingWorkspace as publishingWorkspaceBreadcrumbs } from "@/components/ui/breadcrumb/breadcrumbs/documents";
import { documentApi } from "@/services/api/documents";
import { publishingTemplatesApi } from "@/services/api/publishingTemplates";
import type { PublishingPlaceholderGroupResponse, PublishingTemplateResponse, PublishingWorkspaceResponse } from "./types";
import { buildRevisionDetailNavigationState, buildRevisionWorkspaceSourceState } from "@/features/documents/shared/navigationContext";
import { buildPreviewVersionCacheBuster, replaceObjectUrlPreview, revokeObjectUrl } from "@/features/documents/shared/previewHelpers";
import { cn } from "@/components/ui/utils";
import { BORDER_RADIUS, COLORS, COMPONENT_PRESETS, PADDING, SHADOW, TYPOGRAPHY } from "@/config/ui-standards";
import { IconBookmark, IconFileOrientation, IconFileTypePdf } from "@tabler/icons-react";

const extractApiMessage = (error: unknown, fallback: string): string => {
  if (typeof error === "object" && error !== null) {
    const response = (error as { response?: { data?: unknown } }).response;
    const data = response?.data as
      | { message?: string; error?: { message?: string }; body?: { message?: string } }
      | undefined;
    const message = data?.message || data?.error?.message || data?.body?.message;
    if (message) {
      return message;
    }
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
};

type PreviewSection = "cover" | "body" | "header" | "footer";

const normalizePublishingMode = (value?: string | null) => {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "COVER_AND_HEADER_FOOTER") return "COVER_HEADER_FOOTER";
  if (normalized === "BODY_HEADER_FOOTER_ONLY") return "HEADER_FOOTER_ONLY";
  if (normalized === "COVER_HEADER_FOOTER" || normalized === "HEADER_FOOTER_ONLY") {
    return normalized;
  }
  return "COVER_ONLY";
};

const formatPublishingMode = (value?: string | null) => {
  const normalized = normalizePublishingMode(value);
  if (normalized === "COVER_HEADER_FOOTER") return "Cover + Header/Footer";
  if (normalized === "HEADER_FOOTER_ONLY") return "Header/Footer only";
  return "Cover only";
};

const formatPublishingLayout = (value?: string | null) => {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "LANDSCAPE") return "Landscape";
  if (normalized === "PORTRAIT") return "Portrait";
  return "Unknown";
};

const buildWorkspacePreviewCacheBuster = (
  workspace: PublishingWorkspaceResponse | null | undefined,
) => buildPreviewVersionCacheBuster(
  workspace?.publishingPreviewVersionToken || workspace?.previewVersionToken,
);

interface PublishingWorkspaceViewProps {
  revisionId: string;
  onBack: () => void;
}

type PageRangeDraft = {
  coverSourcePageFrom: string;
  coverSourcePageTo: string;
  bodySourcePageFrom: string;
  bodySourcePageTo: string;
  headerPageFrom: string;
  headerPageTo: string;
  footerPageFrom: string;
  footerPageTo: string;
  watermarkPageFrom: string;
  watermarkPageTo: string;
};

const EMPTY_PAGE_RANGE_DRAFT: PageRangeDraft = {
  coverSourcePageFrom: "1",
  coverSourcePageTo: "1",
  bodySourcePageFrom: "1",
  bodySourcePageTo: "",
  headerPageFrom: "2",
  headerPageTo: "",
  footerPageFrom: "2",
  footerPageTo: "",
  watermarkPageFrom: "",
  watermarkPageTo: "",
};

export const PublishingWorkspaceView: React.FC<PublishingWorkspaceViewProps> = ({ revisionId, onBack }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { navigateTo } = useNavigateWithLoading();
  const { showToast } = useToast();
  const shouldReduceMotion = useReducedMotion();
  const collapseTransition = useMemo(
    () => (shouldReduceMotion ? { duration: 0 } : { type: "spring" as const, stiffness: 90, damping: 16 }),
    [shouldReduceMotion],
  );
  const [workspace, setWorkspace] = useState<PublishingWorkspaceResponse | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [selectedLayout, setSelectedLayout] = useState<string>("");
  const [changeSummary, setChangeSummary] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [componentPreviewUrls, setComponentPreviewUrls] = useState<Record<string, string | null>>({});
  const [activePreviewComponent, setActivePreviewComponent] = useState<"cover" | "header" | "footer">("cover");
  const [componentPreviewVisibility, setComponentPreviewVisibility] = useState<Record<"cover" | "header" | "footer", boolean>>({ cover: true, header: true, footer: true });
  const [componentPreviewExpanded, setComponentPreviewExpanded] = useState(false);
  const [componentEnabled, setComponentEnabled] = useState<Record<"cover" | "header" | "footer", boolean>>({ cover: true, header: true, footer: true });
  const [hoveredPreviewSection, setHoveredPreviewSection] = useState<PreviewSection | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingAction, setSavingAction] = useState<"preview" | "publish" | null>(null);
  const [publishingJobPolling, setPublishingJobPolling] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const skipAutoRefreshRef = useRef(true);
  const [previewRefreshLoading, setPreviewRefreshLoading] = useState(false);
  const [componentPreviewLoadingMap, setComponentPreviewLoadingMap] = useState<Record<"cover" | "header" | "footer", boolean>>({
    cover: false,
    header: false,
    footer: false,
  });
  const [pageRangeDraft, setPageRangeDraft] = useState<PageRangeDraft>(EMPTY_PAGE_RANGE_DRAFT);
  const [placeholderCatalog, setPlaceholderCatalog] = useState<PublishingPlaceholderGroupResponse[]>([]);
  const componentPreviewSignatureRef = useRef<string>("");
  const revisionActionCapabilities = useRevisionActionCapabilities(revisionId);

  const templates = workspace?.templates || [];
  const revision = workspace?.revision;
  const breadcrumbItems = useMemo(() => publishingWorkspaceBreadcrumbs(navigateTo), [navigateTo]);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) || null,
    [selectedTemplateId, templates],
  );

  const selectedTemplateAvailableLayouts = useMemo(() => {
    if (!selectedTemplate) {
      return [];
    }
    const mode = normalizePublishingMode(selectedTemplate.publishingMode);
    const requiredComponents =
      mode === "COVER_HEADER_FOOTER"
        ? ["cover", "header", "footer"]
        : mode === "HEADER_FOOTER_ONLY"
          ? ["header", "footer"]
          : ["cover"];
    return (["PORTRAIT", "LANDSCAPE"] as const).filter((layout) =>
      requiredComponents.every((componentType) =>
        (selectedTemplate.components || []).some(
          (item) =>
            String(item.componentType || "").toLowerCase() === componentType &&
            String(item.layout || "").toUpperCase() === layout &&
            Boolean(item.fileName || item.objectKey),
        ),
      ),
    );
  }, [selectedTemplate]);

  const selectedTemplatePublishingMode = useMemo(() => {
    return normalizePublishingMode(selectedTemplate?.publishingMode);
  }, [selectedTemplate?.publishingMode]);
  const normalizedPublishingJobStatus = String(workspace?.publishingJobStatus || "").toUpperCase();
  const isPublishingJobActive = publishingJobPolling || normalizedPublishingJobStatus === "QUEUED" || normalizedPublishingJobStatus === "PROCESSING";
  const availableLayouts = workspace?.availableLayouts?.length ? workspace.availableLayouts : selectedTemplateAvailableLayouts;
  const hasMultipleLayouts = availableLayouts.length > 1;
  const singleAvailableLayout = availableLayouts.length === 1 ? availableLayouts[0] : "";
  const canGeneratePublishingPreview = !revisionActionCapabilities.loading
    && availableLayouts.length > 0
    && revisionActionCapabilities.can("openPublishingWorkspace");
  const canPublish = !revisionActionCapabilities.loading
    && Boolean(workspace?.previewReady && availableLayouts.length > 0 && !isPublishingJobActive)
    && revisionActionCapabilities.can("publish");

  const selectedTemplatePageRange = useMemo(() => {
    if (!selectedTemplate) {
      return EMPTY_PAGE_RANGE_DRAFT;
    }
    return {
      coverSourcePageFrom: String(selectedTemplate.coverSourcePageFrom ?? 1),
      coverSourcePageTo: String(selectedTemplate.coverSourcePageTo ?? 1),
      bodySourcePageFrom: "1",
      bodySourcePageTo: selectedTemplate.bodySourcePageTo == null ? "" : String(selectedTemplate.bodySourcePageTo),
      headerPageFrom: String(Math.max(selectedTemplate.headerPageFrom ?? 2, 2)),
      headerPageTo: selectedTemplate.headerPageTo == null ? "" : String(selectedTemplate.headerPageTo),
      footerPageFrom: String(Math.max(selectedTemplate.footerPageFrom ?? 2, 2)),
      footerPageTo: selectedTemplate.footerPageTo == null ? "" : String(selectedTemplate.footerPageTo),
      watermarkPageFrom: selectedTemplate.watermarkPageFrom == null ? "" : String(selectedTemplate.watermarkPageFrom),
      watermarkPageTo: selectedTemplate.watermarkPageTo == null ? "" : String(selectedTemplate.watermarkPageTo),
    };
  }, [selectedTemplate]);

  const normalizedSelectedLayout = useMemo(() => {
    const candidate = String(selectedLayout || workspace?.selectedLayout || "").toUpperCase();
    if (candidate === "LANDSCAPE" && availableLayouts.includes("LANDSCAPE")) {
      return "LANDSCAPE";
    }
    if (candidate === "PORTRAIT" && availableLayouts.includes("PORTRAIT")) {
      return "PORTRAIT";
    }
    return availableLayouts[0] || candidate || "";
  }, [availableLayouts, selectedLayout, workspace?.selectedLayout]);

  const selectedLayoutLabel = useMemo(() => formatPublishingLayout(normalizedSelectedLayout), [normalizedSelectedLayout]);

  const availablePreviewComponents = useMemo(() => {
    const COMPONENT_ORDER = ["cover", "header", "footer"] as const;
    const serverComponents = (workspace?.availablePreviewComponents || [])
      .map((item) => String(item || "").toLowerCase())
      .filter((item): item is "cover" | "header" | "footer" => item === "cover" || item === "header" || item === "footer");

    const componentSet = new Set<"cover" | "header" | "footer">(serverComponents);
    if (selectedTemplate) {
      COMPONENT_ORDER.forEach((component) => {
        const fileName =
          component === "cover"
            ? templateComponentFileName("cover") || selectedTemplate.coverFileName
            : component === "header"
              ? templateComponentFileName("header") || selectedTemplate.headerFileName
              : templateComponentFileName("footer") || selectedTemplate.footerFileName;
        if (fileName) {
          componentSet.add(component);
        }
      });
    }

    return COMPONENT_ORDER.filter((component) => componentSet.has(component));
  }, [selectedTemplate, normalizedSelectedLayout, workspace?.availablePreviewComponents]);

  const signaturePlaceholderItems = useMemo(() => {
    const group =
      placeholderCatalog.find((entry) =>
        String(entry.title || "").toLowerCase().includes("sign-off"),
      ) ||
      placeholderCatalog.find((entry) =>
        (entry.items || []).some((item) => String(item.value || "").includes("SIGNATURE")),
      ) ||
      null;
    return group?.items || [];
  }, [placeholderCatalog]);

  const hasComponentPreviewSlots = availablePreviewComponents.length > 0;
  const showComponentPreviewControls = availablePreviewComponents.length > 1;

  function templateComponentFileName(component: "cover" | "header" | "footer") {
    const matched = selectedTemplate?.components?.find(
      (item) =>
        String(item.componentType || "").toLowerCase() === component &&
        String(item.layout || "").toUpperCase() === normalizedSelectedLayout,
    );
    return matched?.fileName || null;
  }

  const componentPreviewSignature = useMemo(() => {
    const templateId = selectedTemplate?.id || "";
    const componentEntries = (["cover", "header", "footer"] as const)
      .map((component) => {
        const matched = selectedTemplate?.components?.find(
          (item) =>
            String(item.componentType || "").toLowerCase() === component &&
            String(item.layout || "").toUpperCase() === normalizedSelectedLayout,
        );
        return [
          component,
          matched?.fileName || "",
          matched?.objectKey || "",
          matched?.checksum || "",
          matched?.uploadedAt || "",
          selectedTemplate?.updatedAt || "",
          selectedTemplate?.versionNumber || "",
        ].join(":");
      })
      .join("|");
    return [templateId, normalizedSelectedLayout, componentEntries].join("::");
  }, [
    normalizedSelectedLayout,
    selectedTemplate?.components,
    selectedTemplate?.id,
    selectedTemplate?.updatedAt,
    selectedTemplate?.versionNumber,
  ]);

  useEffect(() => {
    if (availableLayouts.length === 0) {
      setSelectedLayout("");
      return;
    }
    if (!selectedLayout || !availableLayouts.includes(String(selectedLayout).toUpperCase())) {
      setSelectedLayout(availableLayouts[0]);
    }
  }, [availableLayouts, selectedLayout]);

  useEffect(() => {
    if (availableLayouts.length === 1) {
      setSelectedLayout(availableLayouts[0]);
    }
  }, [availableLayouts]);

  useEffect(() => {
    setPageRangeDraft(selectedTemplatePageRange);
  }, [selectedTemplatePageRange]);

  const coverEnabled = availablePreviewComponents.includes("cover") ? componentEnabled.cover : false;
  const bodyStartPage = coverEnabled ? 2 : 1;

  const pageRangeHighlights = useMemo(() => {
    const pageCount = workspace?.previewPageCount || 0;
    if (pageCount <= 0) {
      return [];
    }
    const highlights: Array<{ key: string; label: string; from: number; to: number; tone: "emerald" | "slate" | "amber" | "blue" | "rose" }> = [];
    if (coverEnabled) {
      highlights.push({ key: "cover", label: "Cover", from: 1, to: 1, tone: "emerald" });
    }
    highlights.push({ key: "body", label: "Body", from: bodyStartPage, to: pageCount, tone: "slate" });
    if (selectedTemplate?.headerFileName || templateComponentFileName("header")) {
      highlights.push({ key: "header", label: "Header", from: bodyStartPage, to: pageCount, tone: "blue" });
    }
    if (selectedTemplate?.footerFileName || templateComponentFileName("footer")) {
      highlights.push({ key: "footer", label: "Footer", from: bodyStartPage, to: pageCount, tone: "amber" });
    }
    return highlights;
  }, [workspace?.previewPageCount, coverEnabled, bodyStartPage, selectedTemplate?.headerFileName, selectedTemplate?.footerFileName, selectedTemplate?.components, normalizedSelectedLayout]);

  const buildPageRangePayload = () => ({
    coverSourcePageFrom: 1,
    coverSourcePageTo: 1,
    bodySourcePageFrom: 1,
    bodySourcePageTo: null,
    headerPageFrom: normalizeDraftNumber(pageRangeDraft.headerPageFrom, bodyStartPage),
    headerPageTo: normalizeDraftNumber(pageRangeDraft.headerPageTo, null),
    footerPageFrom: normalizeDraftNumber(pageRangeDraft.footerPageFrom, bodyStartPage),
    footerPageTo: normalizeDraftNumber(pageRangeDraft.footerPageTo, null),
    watermarkPageFrom: normalizeDraftNumber(pageRangeDraft.watermarkPageFrom, null),
    watermarkPageTo: normalizeDraftNumber(pageRangeDraft.watermarkPageTo, null),
  });

  function normalizeDraftNumber(value: string, fallback: number | null) {
    if (value === "") {
      return fallback;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function validatePageRangeDraft() {
    const headerFrom = normalizeDraftNumber(pageRangeDraft.headerPageFrom, 2) ?? 2;
    const headerTo = normalizeDraftNumber(pageRangeDraft.headerPageTo, null);
    const footerFrom = normalizeDraftNumber(pageRangeDraft.footerPageFrom, 2) ?? 2;
    const footerTo = normalizeDraftNumber(pageRangeDraft.footerPageTo, null);
    const watermarkFrom = normalizeDraftNumber(pageRangeDraft.watermarkPageFrom, null);
    const watermarkTo = normalizeDraftNumber(pageRangeDraft.watermarkPageTo, null);

    if (headerTo != null && headerTo < headerFrom) {
      return "Header end page must be greater than or equal to the start page.";
    }
    if (footerTo != null && footerTo < footerFrom) {
      return "Footer end page must be greater than or equal to the start page.";
    }
    if (watermarkFrom != null && watermarkFrom < 1) {
      return "Watermark page range must start from page 1 or later.";
    }
    if (watermarkTo != null && watermarkFrom != null && watermarkTo < watermarkFrom) {
      return "Watermark end page must be greater than or equal to the start page.";
    }
    return null;
  }

  const previewFocusSection: PreviewSection = hoveredPreviewSection || (activePreviewComponent === "cover" ? "cover" : activePreviewComponent);

  const getPreviewSectionClass = (section: PreviewSection, kind: "cover" | "body" | "band") => {
    const isFocused = previewFocusSection === section;
    const base = "rounded-xl border p-3 transition-all duration-200";
    if (kind === "cover") {
      return `${base} ${isFocused ? "border-emerald-400 bg-emerald-100 shadow-md shadow-emerald-100" : "border-emerald-200 bg-emerald-50"}`;
    }
    if (kind === "body") {
      return `${base} ${isFocused ? "border-slate-400 bg-slate-100 shadow-md shadow-slate-100" : "border-slate-200 bg-slate-50"}`;
    }
    return `${base} ${isFocused ? "border-amber-400 bg-amber-100 shadow-md shadow-amber-100" : "border-slate-200 bg-slate-50"}`;
  };

  const handleOpenTemplateEditor = () => {
    if (!selectedTemplateId) {
      return;
    }
    navigate(
      `${ROUTES.DOCUMENTS.ADMIN.PUBLISHING_TEMPLATES_EDIT(selectedTemplateId)}?revisionId=${encodeURIComponent(revisionId)}`,
      {
        state: {
          from: `${location.pathname}${location.search}`,
          returnTo: `${location.pathname}${location.search}`,
          workspaceReturnPath: `${location.pathname}${location.search}`,
        },
      },
    );
  };

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        setPreviewLoading(true);
        let data = await documentApi.getPublishingWorkspace(revisionId);
        const revisionStatus = String(data.revision?.status || data.revisionStatus || "").toUpperCase();
        if (!alive) return;
        setWorkspace(data);
        setSelectedTemplateId(
          data.selectedTemplateId ||
            data.templates?.find((item) => item.status === "ACTIVE")?.id ||
            data.templates?.[0]?.id ||
            "",
        );
        setSelectedLayout(
          data.selectedLayout ||
            data.availableLayouts?.[0] ||
            "PORTRAIT",
        );
        setChangeSummary(data.revision?.revisionNumber ? `Publishing package for revision ${data.revision.revisionNumber}` : "");
        if (data.previewReady) {
          const blob = await documentApi.getPublishingWorkspacePreview(
            revisionId,
            buildWorkspacePreviewCacheBuster(data),
          );
          if (!alive) return;
          setPreviewUrl((current) => replaceObjectUrlPreview(current, blob));
        } else {
          setPreviewUrl(null);
        }
      } catch (error) {
        console.error("Failed to load publishing workspace", error);
        showToast({ type: "error", title: "Publishing Workspace", message: extractApiMessage(error, "Couldn't load workspace.") });
      } finally {
        if (alive) {
          setPreviewLoading(false);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [revisionId]);


  useEffect(() => {
    const normalizedStatus = String(workspace?.publishingJobStatus || "").toUpperCase();
    const shouldPoll = Boolean(workspace && !workspace.previewReady && (normalizedStatus === "QUEUED" || normalizedStatus === "PROCESSING"));
    if (!shouldPoll) {
      setPublishingJobPolling(false);
      return;
    }

    let alive = true;
    let requestInFlight = false;
    let timer: number | undefined;
    setPublishingJobPolling(true);
    const schedule = (delayMs = 1_800) => {
      if (!alive || workspace?.previewReady) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void refresh(), delayMs);
    };
    const refresh = async () => {
      if (!alive || requestInFlight || document.visibilityState !== "visible" || !navigator.onLine) {
        schedule();
        return;
      }
      requestInFlight = true;
      try {
        const updated = await documentApi.getPublishingWorkspace(revisionId);
        if (!alive) {
          return;
        }
        setWorkspace(updated);
        if (updated.previewReady) {
          const blob = await documentApi.getPublishingWorkspacePreview(
            revisionId,
            buildWorkspacePreviewCacheBuster(updated),
          );
          if (!alive) {
            return;
          }
          setPreviewUrl((current) => replaceObjectUrlPreview(current, blob));
          setPublishingJobPolling(false);
          return;
        }
      } catch (error) {
        console.error("Failed to poll publishing workspace preview status", error);
      } finally {
        requestInFlight = false;
        schedule();
      }
    };
    const onVisibilityOrOnline = () => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        schedule(0);
      }
    };
    document.addEventListener("visibilitychange", onVisibilityOrOnline);
    window.addEventListener("online", onVisibilityOrOnline);
    schedule(0);

    return () => {
      alive = false;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityOrOnline);
      window.removeEventListener("online", onVisibilityOrOnline);
      setPublishingJobPolling(false);
    };
  }, [revisionId, workspace?.previewReady, workspace?.publishingJobStatus]);

  useEffect(() => {
    if (!workspace?.previewReady || previewUrl) {
      return;
    }
    let alive = true;
    void (async () => {
      try {
        const blob = await documentApi.getPublishingWorkspacePreview(
          revisionId,
          buildWorkspacePreviewCacheBuster(workspace),
        );
        if (!alive) {
          return;
        }
          setPreviewUrl((current) => replaceObjectUrlPreview(current, blob));
      } catch (error) {
        console.error("Failed to load publishing workspace preview", error);
        if (alive) {
          showToast({ type: "error", title: "Publishing Workspace", message: "Couldn't load preview PDF." });
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [revisionId, previewUrl, showToast, workspace?.previewReady]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const response = await publishingTemplatesApi.getAvailablePlaceholders();
        if (!alive) {
          return;
        }
        setPlaceholderCatalog(Array.isArray(response?.groups) ? response.groups.filter(Boolean) : []);
      } catch (error) {
        if (!alive) {
          return;
        }
        console.error("Failed to load placeholder catalog", error);
        setPlaceholderCatalog([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!workspace || !selectedTemplateId || availableLayouts.length === 0) {
      return;
    }
    if (skipAutoRefreshRef.current) {
      skipAutoRefreshRef.current = false;
      return;
    }
    if (previewLoading || saving) {
      return;
    }
    const timer = window.setTimeout(() => {
      void handleGeneratePreview();
    }, 250);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedSelectedLayout, selectedTemplateId, availableLayouts.length, componentEnabled.cover]);

  useEffect(() => {
    if (!hasComponentPreviewSlots) {
      return;
    }
    if (!availablePreviewComponents.includes(activePreviewComponent)) {
      setActivePreviewComponent(availablePreviewComponents[0]);
    }
  }, [activePreviewComponent, availablePreviewComponents, hasComponentPreviewSlots]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        revokeObjectUrl(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    return () => {
      Object.values(componentPreviewUrls).forEach((url) => revokeObjectUrl(url));
    };
  }, [componentPreviewUrls]);

  const handleGeneratePreview = async () => {
    const rangeError = validatePageRangeDraft();
    if (rangeError) {
      showToast({ type: "error", title: "Publishing Range", message: rangeError });
      return;
    }
    setPreviewRefreshLoading(true);
    setSaving(true);
    setSavingAction("preview");
    try {
      const data = await documentApi.generatePublishingPreview(revisionId, {
        publishingTemplateId: selectedTemplateId || null,
        selectedLayout: normalizedSelectedLayout || null,
        changeSummary: changeSummary || null,
        ...buildPageRangePayload(),
        enableCover: availablePreviewComponents.includes("cover") ? componentEnabled.cover : null,
        enableHeader: availablePreviewComponents.includes("header") ? componentEnabled.header : null,
        enableFooter: availablePreviewComponents.includes("footer") ? componentEnabled.footer : null,
      });
      setWorkspace(data);
      const blob = await documentApi.getPublishingWorkspacePreview(
        revisionId,
        buildWorkspacePreviewCacheBuster(data),
      );
      setPreviewUrl((current) => replaceObjectUrlPreview(current, blob));
    } catch (error) {
      console.error("Failed to generate publishing preview", error);
      showToast({ type: "error", title: "Publishing Preview", message: extractApiMessage(error, "Couldn't generate preview.") });
    } finally {
      setSaving(false);
      setSavingAction(null);
      setPreviewRefreshLoading(false);
    }
  };

  const handlePublishConfirm = async (signature: { reason: string; signatureToken?: string }) => {
    const rangeError = validatePageRangeDraft();
    if (rangeError) {
      showToast({ type: "error", title: "Publishing Range", message: rangeError });
      return;
    }
    setSaving(true);
    setSavingAction("publish");
    setShowPublishModal(false);
    try {
      const initialWs = await documentApi.publishFromPublishingWorkspace(revisionId, {
        publishingTemplateId: selectedTemplateId || undefined,
        selectedLayout: normalizedSelectedLayout || undefined,
        changeSummary: changeSummary || undefined,
        signatureToken: signature.signatureToken || undefined,
        reason: signature.reason || undefined,
        ...buildPageRangePayload(),
      });

      // Poll until the background publishing job completes (converting PDF & setting Effective status)
      let currentWs = initialWs;
      let pollCount = 0;
      const maxPolls = 30; // Up to 60s
      while (pollCount < maxPolls) {
        const jobStatus = String(currentWs?.publishingJobStatus || "").toUpperCase();
        if (jobStatus === "COMPLETED") {
          break;
        }
        if (jobStatus === "FAILED") {
          throw new Error(
            currentWs?.publishingJobError ||
              currentWs?.publishingJobMessage ||
              "Publishing job failed on server.",
          );
        }

        await new Promise((resolve) => setTimeout(resolve, 2000));
        pollCount++;

        try {
          currentWs = await documentApi.getPublishingWorkspace(revisionId);
        } catch (pollErr: any) {
          const errMsg = pollErr?.response?.data?.message || pollErr?.message || "";
          if (
            errMsg.toLowerCase().includes("ready for publishing") ||
            pollErr?.response?.status === 400 ||
            pollErr?.response?.status === 403
          ) {
            // Revision status has transitioned away from Ready For Publishing to Effective/Published
            break;
          }
        }
      }

      showToast({ type: "success", title: "Revision Published", message: "Revision has been published to Effective successfully." });
      const refreshed = await documentApi.getRevisionByIdSnapshot(revisionId, { force: true });
      navigateTo(ROUTES.DOCUMENTS.REVISIONS.DETAIL(revisionId), {
        state: buildRevisionDetailNavigationState({
          from: ROUTES.DOCUMENTS.REVISIONS.ALL,
          returnTo: ROUTES.DOCUMENTS.REVISIONS.ALL,
          workspaceMode: "create",
          parentDocumentId: revision?.documentId || revision?.originalDocument?.id || undefined,
          sourceRevisionId: revisionId,
          revisionId,
          documentId: revision?.documentId || revision?.originalDocument?.id || undefined,
          documentNumber: refreshed?.documentNumber || revision?.documentNumber || "",
          documentName: refreshed?.documentName || revision?.documentName || "",
          revisionNumber: refreshed?.revisionNumber || revision?.revisionNumber || "",
          workspaceState: buildRevisionWorkspaceSourceState({
            id: revision?.documentId || revision?.originalDocument?.id || null,
            documentNumber: refreshed?.documentNumber || revision?.documentNumber || "",
            documentName: refreshed?.documentName || revision?.documentName || "",
            revisionNumber: refreshed?.revisionNumber || revision?.revisionNumber || "",
            created: refreshed?.created || revision?.created || "",
            openedBy: refreshed?.openedBy || revision?.openedBy || "",
            author: refreshed?.author || revision?.author || "",
            businessUnit: refreshed?.businessUnit || revision?.businessUnit || "",
            department: refreshed?.department || revision?.department || "",
            coAuthors: refreshed?.coAuthors?.map((item) => item.fullName) || revision?.coAuthors?.map((item) => item.fullName) || [],
            knowledgeBase: refreshed?.knowledgeBase || revision?.knowledgeBase || "",
            subType: refreshed?.subType || revision?.subType || "",
            periodicReviewCycle: refreshed?.periodicReviewCycle ?? revision?.periodicReviewCycle,
            periodicReviewNotification: refreshed?.periodicReviewNotification ?? revision?.periodicReviewNotification,
            language: refreshed?.language || revision?.language || "",
            reviewDate: refreshed?.reviewDate || revision?.reviewDate || "",
            description: refreshed?.description || revision?.description || "",
            isTemplate: Boolean(refreshed?.isTemplate ?? revision?.isTemplate),
            titleLocalLanguage: refreshed?.titleLocalLanguage || revision?.titleLocalLanguage || "",
            type: refreshed?.type || revision?.type || "",
            status: refreshed?.status || revision?.status || null,
          }),
          detail: refreshed,
        }),
      });
    } catch (error) {
      console.error("Failed to publish revision", error);
      showToast({ type: "error", title: "Publish Revision", message: extractApiMessage(error, "Couldn't publish revision.") });
    } finally {
      setSaving(false);
      setSavingAction(null);
      setShowPublishModal(false);
    }
  };

  if (previewLoading) {
    return <FullPageLoading text="Loading publishing workspace..." />;
  }

  if (!workspace) {
    return (
      <div className="flex w-full flex-col gap-4 md:gap-6">
        <PageHeader
          title="Publishing Workspace"
          breadcrumbItems={breadcrumbItems}
        />
        <div className={cn(BORDER_RADIUS.card, "border border-red-200 bg-red-50 p-4 text-sm text-red-800")}>
          Couldn't load workspace.
        </div>
        <Button onClick={onBack} size="sm" variant="outline-emerald" className="w-fit">
          Back
        </Button>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-4 md:gap-6">
      {(saving || publishingJobPolling) && (
        <FullPageLoading
          text={
            publishingJobPolling
              ? "Finalizing publishing job, please wait..."
              : savingAction === "publish"
                ? "Publishing the revision, please wait..."
                : "Generating publishing preview, please wait..."
          }
        />
      )}


      <ESignatureModal
        isOpen={showPublishModal}
        onClose={() => setShowPublishModal(false)}
        onConfirm={handlePublishConfirm}
        actionTitle="Publish Revision to Effective"
        meaningDisplayName="Published"
        meaningCode="PUBLISHED"
        changes={[
          { action: "Update Status", oldValue: "Ready for Publishing", newValue: "Effective", category: "status" },
        ]}
        targetDetails={{
          code: revision?.documentNumber || "",
          title: revision?.documentName || "",
          revision: revision?.revisionNumber || "",
        }}
      />

      <PageHeader
        title="Publishing Workspace"
        breadcrumbItems={breadcrumbItems}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={onBack} size="sm" variant="outline-emerald" className="whitespace-nowrap">
              Back
            </Button>
            <Button onClick={handleOpenTemplateEditor} size="sm" variant="outline-emerald" className="gap-2 whitespace-nowrap" disabled={!selectedTemplateId}>
              Open Template Editor
            </Button>
            <Button onClick={handleGeneratePreview} size="sm" variant="outline-emerald" className="gap-2 whitespace-nowrap" disabled={!canGeneratePublishingPreview}>
              Regenerate Preview
            </Button>
            <Button
              onClick={() => {
                setShowPublishModal(true);
              }}
              size="sm"
              variant="default"
              className="gap-2 whitespace-nowrap"
              disabled={!canPublish || isPublishingJobActive}
            >
              {isPublishingJobActive ? "Publishing..." : "Publish"}
            </Button>
          </div>
        }
      />

      {availableLayouts.length === 0 && (
        <div className={cn(BORDER_RADIUS.card, "border border-red-200 bg-red-50 p-3 text-sm text-red-800")}>
          No publishing layout is configured for the selected template. Upload matching layout DOCX files before preview or publish.
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)] xl:gap-6">
        <div className="space-y-4">
          <FormSection title="Configuration" icon={<Layers3 className="h-4 w-4" />}>
            <div className="space-y-4">
              <div>
                <label className={COMPONENT_PRESETS.formLabel}>Publishing Template</label>
                <Select
                  value={selectedTemplateId || "__none__"}
                  onChange={(value) => setSelectedTemplateId(String(value) === "__none__" ? "" : String(value))}
                  options={[
                    { value: "__none__", label: "No Template (body only)" },
                    ...templates.map((template: PublishingTemplateResponse) => ({
                      value: template.id || "",
                      label: `${template.templateName || "Untitled"}${template.documentType ? ` - ${template.documentType}` : ""} - v${template.versionNumber || 1}`,
                    })),
                  ]}
                />
                {selectedTemplateId && (
                  <button
                    type="button"
                    onClick={handleOpenTemplateEditor}
                    className="mt-2 text-xs font-medium text-emerald-700 hover:text-emerald-800"
                  >
                    Open this template in editor with live revision sample
                  </button>
                )}
              </div>
              {selectedTemplateId && availablePreviewComponents.length > 0 && (
                <div>
                  <label className={COMPONENT_PRESETS.formLabel}>Include in PDF</label>
                  <div className="mt-2 flex flex-wrap gap-x-8 gap-y-2">
                    {availablePreviewComponents.map((component) => (
                      <Checkbox
                        key={component}
                        checked={componentEnabled[component]}
                        onChange={(checked) => setComponentEnabled((prev) => ({ ...prev, [component]: checked }))}
                        label={component.charAt(0).toUpperCase() + component.slice(1)}
                      />
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className={COMPONENT_PRESETS.formLabel}>Publishing Layout</label>
                {hasMultipleLayouts ? (
                  <Select
                    value={normalizedSelectedLayout}
                    onChange={(value) => setSelectedLayout(String(value).toUpperCase())}
                    options={availableLayouts.map((layout) => ({
                      value: layout,
                      label: formatPublishingLayout(layout),
                    }))}
                    placeholder="Select a layout"
                    disabled={availableLayouts.length === 0}
                  />
                ) : (
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                    <span className="font-medium text-slate-900">
                      {singleAvailableLayout ? formatPublishingLayout(singleAvailableLayout) : "No layout configured"}
                    </span>
                    {singleAvailableLayout && <span className="text-xs text-slate-500">· only layout for this template</span>}
                  </div>
                )}
              </div>
            </div>
          </FormSection>

          <FormSection title="Page Range Custom" icon={<IconFileOrientation className="h-4 w-4" />}>
            <div className="space-y-3">
              <p className={TYPOGRAPHY.helpText}>
                {coverEnabled
                  ? "Cover is page 1 of the final PDF; header and footer start from page 2. Leave \"To\" blank for \"to end\". Use Regenerate Preview at the top to apply changes."
                  : "No cover: header and footer start from page 1. Leave \"To\" blank for \"to end\". Use Regenerate Preview at the top to apply changes. Enable Cover above to add one."}
              </p>

              <div className={cn(BORDER_RADIUS.card, COLORS.bg.secondary, "overflow-hidden border border-slate-200")}>
                <table className="w-full text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-2xs font-semibold uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-2">Layer</th>
                      <th className="px-3 py-2">From</th>
                      <th className="px-3 py-2">To</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    <tr>
                      <td className="px-3 py-2 font-medium text-slate-700">Cover</td>
                      <td className="px-3 py-2 text-slate-600">{pageRangeDraft.coverSourcePageFrom}</td>
                      <td className="px-3 py-2 text-slate-600">{pageRangeDraft.coverSourcePageTo}</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-medium text-slate-700">Body</td>
                      <td className="px-3 py-2 text-slate-600">{pageRangeDraft.bodySourcePageFrom}</td>
                      <td className="px-3 py-2 text-slate-600">{pageRangeDraft.bodySourcePageTo || "end"}</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-medium text-slate-700">Header</td>
                      <td className="px-3 py-2 text-slate-600">{bodyStartPage}</td>
                      <td className="px-3 py-1.5">
                        <Input
                          type="number"
                          min={bodyStartPage}
                          value={pageRangeDraft.headerPageTo}
                          onChange={(event) => setPageRangeDraft((prev) => ({ ...prev, headerPageTo: event.target.value }))}
                          placeholder="end"
                          aria-label="Header to page"
                        />
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-medium text-slate-700">Footer</td>
                      <td className="px-3 py-2 text-slate-600">{bodyStartPage}</td>
                      <td className="px-3 py-1.5">
                        <Input
                          type="number"
                          min={bodyStartPage}
                          value={pageRangeDraft.footerPageTo}
                          onChange={(event) => setPageRangeDraft((prev) => ({ ...prev, footerPageTo: event.target.value }))}
                          placeholder="end"
                          aria-label="Footer to page"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
                <p className="border-t border-slate-200 px-3 py-1.5 text-2xs text-slate-400">Cover, Body and the From column are locked.</p>
              </div>

            </div>
          </FormSection>

        </div>

        <div className="min-w-0 space-y-4">
          <FormSection title="PDF Preview" icon={<IconFileTypePdf className="h-4 w-4" />}>
            <div className="space-y-4">
              {previewUrl ? (
                <div className={cn(COLORS.bg.primary, SHADOW.sm, "overflow-hidden border border-slate-200")}>
                  <DocumentPdfViewer
                    fileUrl={previewUrl}
                    height="calc(100vh - 240px)"
                    showThumbnailSidebar={false}
                    pageRangeHighlights={pageRangeHighlights}
                    isLoading={previewRefreshLoading}
                  />
                </div>
              ) : (
                <div className={cn(BORDER_RADIUS.card, COLORS.bg.secondary, "flex min-h-[680px] items-center justify-center border border-dashed border-slate-300 text-sm text-slate-500")}>
                  Preview has not been generated yet.
                </div>
              )}
            </div>
          </FormSection>
        </div>
      </div>
    </div>
  );
};
