import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Check,
  ChevronDown,
  Copy,
  Eye,
  GalleryHorizontalEnd,
  Info,
  Loader2,
  RefreshCw,
  Search,
  Send,
  Trash2,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge/Badge";
import { FullPageLoading } from "@/components/ui/loading";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import { DocumentPdfViewer } from "@/features/documents/shared/components/DocumentPdfViewer";
import { FormSection } from "@/components/ui/form/FormSection";
import { Input } from "@/components/ui/form/ResponsiveForm";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/components/ui/utils";
import { ROUTES } from "@/app/routes.constants";
import { useNavigateWithLoading } from "@/hooks/useNavigateWithLoading";
import { useDebounce } from "@/hooks/useDebounce";
import { usePortalDropdown } from "@/hooks/usePortalDropdown";
import { PortalDropdownMenu } from "@/components/ui/dropdown";
import { navigateBack } from "@/app/navigation/backNavigation";
import { publishingTemplateCreate, publishingTemplateEdit } from "@/components/ui/breadcrumb/breadcrumbs/settings";
import { publishingTemplatesApi } from "@/services/api/publishingTemplates";
import type {
  PublishingPlaceholderGroupResponse,
  PublishingPlaceholderStyleConfig,
  PublishingPlaceholderStyleResponse,
  PublishingTemplateComponentResponse,
  PublishingTemplateResponse,
} from "@/features/documents/publishing/types";
import {
  BORDER_RADIUS,
  COLORS,
  COMPONENT_PRESETS,
  PADDING,
  SHADOW,
  TYPOGRAPHY,
} from "@/config/ui-standards";
import { Popover } from "@/components/ui/popover/Popover";
import { IconInfoCircle } from "@tabler/icons-react";
import { ColorPickerInput } from "@/components/ui/color-picker/ColorPickerInput";
import { DEFAULT_BLACK_HEX } from "@/styles/tokens";

type LayoutType = "PORTRAIT" | "LANDSCAPE";
type ComponentType = "cover" | "header" | "footer";

interface TemplateFormState {
  templateName: string;
  description: string;
  status: string;
  publishingMode: string;
}

interface TemplateSlotState {
  fileName?: string | null;
  uploadedBy?: string | null;
  uploadedAt?: string | null;
  checksum?: string | null;
  status?: string | null;
  detectedPlaceholders?: string[];
  previewAvailable?: boolean;
  objectKey?: string | null;
}

const SLOT_GROUPS: Array<{
  componentType: ComponentType;
  title: string;
  help: string;
}> = [
  {
    componentType: "cover",
    title: "Cover Template",
    help: "First page only. Body source always starts from page 1. In the final PDF, the cover becomes page 1 and header/footer start from page 2 when cover is enabled. Upload a separate .docx for each supported layout.",
  },
  {
    componentType: "header",
    title: "Header Template",
    help: "Upload a DOCX that contains only the Word header section. Body content is ignored.",
  },
  {
    componentType: "footer",
    title: "Footer Template",
    help: "Upload a DOCX that contains only the Word footer section. Body content is ignored.",
  },
];

const FORM_DEFAULTS: TemplateFormState = {
  templateName: "",
  description: "",
  status: "DRAFT",
  publishingMode: "COVER_ONLY",
};

const PUBLISHING_MODE_OPTIONS = [
  { value: "COVER_ONLY", label: "Cover only" },
  { value: "COVER_HEADER_FOOTER", label: "Cover + Header/Footer" },
  { value: "HEADER_FOOTER_ONLY", label: "Header/Footer only" },
];

const FONT_FAMILY_OPTIONS = [
  { value: "", label: "Use Word style" },
  { value: "Arial", label: "Arial" },
  { value: "Times New Roman", label: "Times New Roman" },
  { value: "Calibri", label: "Calibri" },
  { value: "Tahoma", label: "Tahoma" },
  { value: "Courier New", label: "Courier New" },
];

const TRANSFORM_OPTIONS = [
  { value: "NONE", label: "None" },
  { value: "TRIM", label: "Trim" },
  { value: "UPPER", label: "Uppercase" },
  { value: "LOWER", label: "Lowercase" },
  { value: "TITLE", label: "Title Case" },
];



const DATE_FORMAT_OPTIONS = [
  { value: "", label: "No date override" },
  { value: "dd/MM/yyyy", label: "dd/MM/yyyy" },
  { value: "dd-MMM-yyyy", label: "dd-MMM-yyyy" },
  { value: "yyyy-MM-dd", label: "yyyy-MM-dd" },
  { value: "MMM dd, yyyy", label: "MMM dd, yyyy" },
  { value: "dd-MMM-yyyy HH:mm", label: "dd-MMM-yyyy HH:mm" },
];

const NUMBER_FORMAT_OPTIONS = [
  { value: "", label: "No number override" },
  { value: "000", label: "001" },
  { value: "0000", label: "0001" },
  { value: "'CC-'0000", label: "CC-0001" },
];

const DEFAULT_PLACEHOLDER_STYLE: PublishingPlaceholderStyleConfig = {
  transforms: [],
  fontFamily: "",
  fontSizePt: null,
  bold: false,
  italic: false,
  underline: false,
  color: DEFAULT_BLACK_HEX,
  alignment: "",
  dateFormat: "",
  numberFormat: "",
  preserveLineBreaks: true,
  maxLines: null,
};

const normalizePlaceholderKey = (value?: string | null) =>
  String(value || "")
    .replace(/^\{\{\s*/, "")
    .replace(/\s*\}\}$/, "")
    .split("|")[0]
    .trim()
    .toLowerCase();

const placeholderToken = (value?: string | null) => {
  const key = normalizePlaceholderKey(value);
  return key ? `{{${key}}}` : "";
};

const inferPlaceholderType = (value?: string | null) => {
  const key = normalizePlaceholderKey(value);
  if (key.includes("signature")) return "SIGNATURE";
  if (key.includes("date") || key.includes("time") || key.endsWith("on")) return "DATE";
  if (key.includes("number") || key.includes("count") || key.includes("page")) return "NUMBER";
  if (key.includes("qr")) return "QR_CODE";
  if (key.includes("barcode")) return "BARCODE";
  if (key.includes("list") || key.includes("reviewer") || key.includes("approver") || key.includes("author")) return "COLLECTION";
  return "TEXT";
};

const toStyleForm = (style?: PublishingPlaceholderStyleConfig | null): PublishingPlaceholderStyleConfig => ({
  ...DEFAULT_PLACEHOLDER_STYLE,
  ...(style || {}),
  transforms: style?.transforms || [],
  fontFamily: style?.fontFamily || "",
  color: style?.color || DEFAULT_BLACK_HEX,
  alignment: style?.alignment || "",
  dateFormat: style?.dateFormat || "",
  numberFormat: style?.numberFormat || "",
  preserveLineBreaks: style?.preserveLineBreaks ?? true,
});

const normalizePublishingMode = (value?: string | null) => {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "COVER_AND_HEADER_FOOTER") return "COVER_HEADER_FOOTER";
  if (normalized === "BODY_HEADER_FOOTER_ONLY") return "HEADER_FOOTER_ONLY";
  if (normalized === "COVER_HEADER_FOOTER" || normalized === "HEADER_FOOTER_ONLY") {
    return normalized;
  }
  return "COVER_ONLY";
};

const layoutLabel = (layout: LayoutType) =>
  layout === "PORTRAIT" ? "Portrait" : "Landscape";

const slotKey = (componentType: ComponentType, layout: LayoutType) =>
  `${componentType}:${layout}`;
const normalizeLayout = (value?: string | null): LayoutType =>
  String(value || "").toUpperCase() === "LANDSCAPE" ? "LANDSCAPE" : "PORTRAIT";
const normalizeComponentType = (value: string): ComponentType => {
  const lower = value.toLowerCase();
  return (["cover", "header", "footer"].includes(lower) ? lower : "cover") as ComponentType;
};

const getTemplateSlotState = (
  components: PublishingTemplateComponentResponse[] | undefined,
  componentType: ComponentType,
  layout: LayoutType,
): TemplateSlotState => {
  const matched = components?.find(
    (item) =>
      normalizeComponentType(String(item.componentType || "")) ===
        componentType && normalizeLayout(item.layout) === layout,
  );
  return matched
    ? {
        fileName: matched.fileName,
        uploadedBy: matched.uploadedBy,
        uploadedAt: matched.uploadedAt,
        checksum: matched.checksum,
        status: matched.status,
        detectedPlaceholders: matched.detectedPlaceholders || [],
        previewAvailable: matched.previewAvailable,
        objectKey: matched.objectKey,
      }
    : { previewAvailable: false, detectedPlaceholders: [] };
};

export const PublishingTemplateEditorView: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { navigateTo, isNavigating } = useNavigateWithLoading();
  const { showToast } = useToast();
  const { id } = useParams<{ id?: string }>();
  const {
    openId: openHeaderMenuId,
    position: headerMenuPosition,
    getRef: getHeaderMenuRef,
    toggle: toggleHeaderMenu,
    close: closeHeaderMenu,
  } = usePortalDropdown();

  const isEditMode = Boolean(id);
  const locationState = (location.state as {
    from?: string;
    returnTo?: string;
    workspaceReturnPath?: string;
  } | null) || null;
  const returnToPath = useMemo(() => {
    return (
      locationState?.workspaceReturnPath ||
      locationState?.returnTo ||
      locationState?.from ||
      ROUTES.SETTINGS.PUBLISHING_TEMPLATES
    );
  }, [locationState?.from, locationState?.returnTo, locationState?.workspaceReturnPath]);
  const handleBack = () => {
    if (locationState?.workspaceReturnPath || locationState?.returnTo || locationState?.from) {
      navigateTo(returnToPath);
      return;
    }
    navigateBack(navigate, null, ROUTES.SETTINGS.PUBLISHING_TEMPLATES);
  };
  const [template, setTemplate] = useState<PublishingTemplateResponse | null>(
    null,
  );
  const [form, setForm] = useState<TemplateFormState>(FORM_DEFAULTS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] =
    useState<PublishingTemplateResponse | null>(null);
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);
  const [activeSlot, setActiveSlot] = useState<string>("cover:PORTRAIT");
  const [slotPreviewUrl, setSlotPreviewUrl] = useState<string | null>(null);
  const [slotPreviewKey, setSlotPreviewKey] = useState<string | null>(null);
  const [slotPreviewLoadingKey, setSlotPreviewLoadingKey] = useState<string | null>(null);
  const [slotPreviewButtonRefreshingKey, setSlotPreviewButtonRefreshingKey] = useState<string | null>(null);
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);
  const [deletingSlot, setDeletingSlot] = useState<string | null>(null);
  const [copiedPlaceholder, setCopiedPlaceholder] = useState<string | null>(
    null,
  );
  const [placeholderCatalog, setPlaceholderCatalog] = useState<PublishingPlaceholderGroupResponse[]>([]);
  const [placeholderCatalogLoading, setPlaceholderCatalogLoading] = useState(false);
  const [placeholderCatalogExpanded, setPlaceholderCatalogExpanded] = useState(false);
  const [placeholderSearch, setPlaceholderSearch] = useState("");
  const debouncedPlaceholderSearch = useDebounce(placeholderSearch, 400);
  const [openAccordionGroups, setOpenAccordionGroups] = useState<Set<number>>(new Set([0]));
  const [placeholderStyles, setPlaceholderStyles] = useState<PublishingPlaceholderStyleResponse[]>([]);
  const [selectedStylePlaceholder, setSelectedStylePlaceholder] = useState<string>("");
  const [styleForm, setStyleForm] = useState<PublishingPlaceholderStyleConfig>(DEFAULT_PLACEHOLDER_STYLE);
  const [isSavingPlaceholderStyle, setIsSavingPlaceholderStyle] = useState(false);
  const [styleModalOpen, setStyleModalOpen] = useState(false);
  const [styleModalSlot, setStyleModalSlot] = useState<{ componentType: ComponentType; layout: LayoutType } | null>(null);
  const [isCompactViewport, setIsCompactViewport] = useState(false);
  const previewUrlRef = useRef<string | null>(null);
  const previewCacheRef = useRef<Map<string, string>>(new Map());
  const previewLoadRequestRef = useRef(0);
  const slotPreviewSourceRef = useRef<Map<string, string>>(new Map());
  // Refs that mirror state — read inside async callbacks / effects to avoid stale closures
  const slotPreviewKeyRef = useRef<string | null>(null);
  const slotPreviewLoadingKeyRef = useRef<string | null>(null);
  const templateRef = useRef<PublishingTemplateResponse | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [deleteSlotTarget, setDeleteSlotTarget] = useState<{
    componentType: ComponentType;
    layout: LayoutType;
  } | null>(null);
  const hasInitializedModeRef = useRef(false);
  const lastPublishingModeRef = useRef<string>(FORM_DEFAULTS.publishingMode);
  const modeSyncRunRef = useRef(0);

  const requiredComponentTypes = useMemo<ComponentType[]>(() => {
    switch (normalizePublishingMode(form.publishingMode)) {
      case "COVER_HEADER_FOOTER":
        return ["cover", "header", "footer"];
      case "HEADER_FOOTER_ONLY":
        return ["header", "footer"];
      default:
        return ["cover"];
    }
  }, [form.publishingMode]);

  const visibleSlotGroups = useMemo(
    () =>
      SLOT_GROUPS.filter((group) =>
        requiredComponentTypes.includes(group.componentType),
      ),
    [requiredComponentTypes],
  );

  const configuredLayouts = useMemo(() => {
    const components = template?.components || [];
    return (["PORTRAIT", "LANDSCAPE"] as LayoutType[]).filter((layout) =>
      requiredComponentTypes.every((componentType) =>
        components.some(
          (item) =>
            normalizeComponentType(String(item.componentType || "")) ===
              componentType &&
            normalizeLayout(item.layout) === layout &&
            Boolean(item.fileName || item.objectKey),
        ),
      ),
    );
  }, [requiredComponentTypes, template?.components]);

  const activeSlotMeta = useMemo(() => {
    const [componentType, layout] = activeSlot.split(":");
    const normalizedComponent = normalizeComponentType(
      componentType || "cover",
    );
    const normalizedLayout = normalizeLayout(layout || "PORTRAIT");
    const state = getTemplateSlotState(
      template?.components,
      normalizedComponent,
      normalizedLayout,
    );
    return {
      componentType: normalizedComponent,
      layout: normalizedLayout,
      state,
      key: slotKey(normalizedComponent, normalizedLayout),
    };
  }, [activeSlot, template?.components]);

  const getFallbackActiveSlot = (
    components: PublishingTemplateComponentResponse[] | undefined,
  ) => {
    for (const componentType of requiredComponentTypes) {
      const portraitState = getTemplateSlotState(
        components,
        componentType,
        "PORTRAIT",
      );
      if (portraitState.fileName || portraitState.objectKey) {
        return slotKey(componentType, "PORTRAIT");
      }
      const landscapeState = getTemplateSlotState(
        components,
        componentType,
        "LANDSCAPE",
      );
      if (landscapeState.fileName || landscapeState.objectKey) {
        return slotKey(componentType, "LANDSCAPE");
      }
    }
    return slotKey(requiredComponentTypes[0] || "cover", "PORTRAIT");
  };

  const selectedLayout = useMemo<LayoutType>(() => {
    if (
      configuredLayouts.includes(
        normalizeLayout(slotPreviewKey?.split(":")[1] || null),
      )
    ) {
      return normalizeLayout(slotPreviewKey?.split(":")[1] || null);
    }
    return configuredLayouts[0] || "PORTRAIT";
  }, [configuredLayouts, slotPreviewKey]);

  const currentSlotState = getTemplateSlotState(
    template?.components,
    activeSlotMeta.componentType,
    activeSlotMeta.layout,
  );
  const activeSlotPreviewUrl =
    slotPreviewKey === activeSlotMeta.key
      ? slotPreviewUrl ||
        previewCacheRef.current.get(activeSlotMeta.key) ||
        null
      : previewCacheRef.current.get(activeSlotMeta.key) || null;
  function getSlotStyleSignature(componentType: ComponentType, layout: LayoutType) {
    return placeholderStyles
      .filter(
        (item) =>
          normalizeComponentType(String(item.componentType || "")) === componentType &&
          normalizeLayout(item.layout) === layout,
      )
      .map((item) =>
        [
          item.placeholderKey || "",
          item.placeholderToken || "",
          item.placeholderType || "",
          item.updatedAt || "",
          item.style ? JSON.stringify(item.style) : "",
        ].join("::"),
      )
      .sort()
      .join("||");
  }

  const activeSlotSourceSignature = useMemo(
    () =>
      [
        currentSlotState.objectKey || "",
        currentSlotState.checksum || "",
        currentSlotState.fileName || "",
        currentSlotState.uploadedAt || "",
        currentSlotState.previewAvailable ? "1" : "0",
        getSlotStyleSignature(activeSlotMeta.componentType, activeSlotMeta.layout),
      ].join("::"),
    [
      currentSlotState.checksum,
      currentSlotState.fileName,
      currentSlotState.objectKey,
      currentSlotState.uploadedAt,
      currentSlotState.previewAvailable,
      placeholderStyles,
      activeSlotMeta.componentType,
      activeSlotMeta.layout,
    ],
  );
  const activeDetectedPlaceholders = getTemplateSlotState(
    template?.components,
    activeSlotMeta.componentType,
    activeSlotMeta.layout,
  ).detectedPlaceholders || [];
  const selectedStyleKey = normalizePlaceholderKey(selectedStylePlaceholder);
const selectedPlaceholderType = inferPlaceholderType(selectedStylePlaceholder);
  const isSignaturePlaceholder = selectedPlaceholderType === "SIGNATURE";

  const modalStyleRecord = useMemo(
    () => styleModalSlot
      ? placeholderStyles.find(
          (item) =>
            normalizeComponentType(String(item.componentType || "")) === styleModalSlot.componentType &&
            normalizeLayout(item.layout) === styleModalSlot.layout &&
            normalizePlaceholderKey(item.placeholderKey) === selectedStyleKey,
        )
      : undefined,
    [styleModalSlot, placeholderStyles, selectedStyleKey],
  );

  templateRef.current = template;

  const getSlotPreviewSourceSignature = (state: TemplateSlotState, styleSignature = "") =>
    [
      state.objectKey || "",
      state.checksum || "",
      state.fileName || "",
      state.uploadedAt || "",
      styleSignature,
    ].join("::");

  const buildTemplatePayload = () => ({
    templateName: form.templateName.trim(),
    description: form.description || null,
    status: form.status,
    publishingMode: form.publishingMode,
    coverOrientation: null,
    bodyOrientation: null,
    enableHeader: true,
    enableFooter: true,
    showLogo: true,
    showQrCode: false,
    showBarcode: false,
    showConfidentiality: true,
    showElectronicSignatureInformation: true,
    watermarkMode: null,
    coverSourcePageFrom: template?.coverSourcePageFrom ?? 1,
    coverSourcePageTo: template?.coverSourcePageTo ?? 1,
    bodySourcePageFrom: template?.bodySourcePageFrom ?? 1,
    bodySourcePageTo: template?.bodySourcePageTo ?? null,
    headerPageFrom: template?.headerPageFrom ?? 2,
    headerPageTo: template?.headerPageTo ?? null,
    footerPageFrom: template?.footerPageFrom ?? 2,
    footerPageTo: template?.footerPageTo ?? null,
    watermarkPageFrom: template?.watermarkPageFrom ?? null,
    watermarkPageTo: template?.watermarkPageTo ?? null,
  });

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setIsLoading(true);
      try {
        const data =
          isEditMode && id
            ? await publishingTemplatesApi.getTemplate(id)
            : null;
        if (!alive) return;
        if (data) {
          setTemplate(data);
          slotPreviewSourceRef.current.clear();
          setForm({
            templateName: data.templateName || "",
            description: data.description || "",
            status: data.status || "DRAFT",
            publishingMode: normalizePublishingMode(data.publishingMode),
          });
          lastPublishingModeRef.current = normalizePublishingMode(data.publishingMode);
          hasInitializedModeRef.current = true;
          const firstConfigured = (data.components || []).find((item) =>
            Boolean(item.fileName || item.objectKey),
          );
          setActiveSlot(
            firstConfigured
              ? slotKey(
                  normalizeComponentType(
                    String(firstConfigured.componentType || "cover"),
                  ),
                  normalizeLayout(firstConfigured.layout),
                )
              : "cover:PORTRAIT",
          );
        } else {
          setTemplate({
            templateName: "",
            description: "",
            status: "DRAFT",
            publishingMode: "COVER_ONLY",
            components: [],
          } as PublishingTemplateResponse);
          slotPreviewSourceRef.current.clear();
          setForm(FORM_DEFAULTS);
          lastPublishingModeRef.current = FORM_DEFAULTS.publishingMode;
          hasInitializedModeRef.current = true;
          setActiveSlot("cover:PORTRAIT");
        }
      } catch (error) {
        console.error("Failed to load publishing template", error);
        showToast({
          type: "error",
          title: "Load failed",
          message: "Unable to load publishing template data.",
        });
      } finally {
        if (alive) setIsLoading(false);
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, [id, isEditMode, showToast]);

  useEffect(() => {
    let alive = true;
    const loadPlaceholders = async () => {
      setPlaceholderCatalogLoading(true);
      try {
        const response = await publishingTemplatesApi.getAvailablePlaceholders(
          debouncedPlaceholderSearch.trim() || undefined,
        );
        if (!alive) {
          return;
        }
        const groups = Array.isArray(response?.groups) ? response.groups.filter(Boolean) : [];
        setPlaceholderCatalog(groups);
        // Expand every matching group while searching so results aren't hidden behind
        // a collapsed accordion; restore the default single-group view once cleared.
        setOpenAccordionGroups(
          debouncedPlaceholderSearch.trim() ? new Set(groups.map((_, index) => index)) : new Set([0]),
        );
      } catch (error) {
        if (!alive) {
          return;
        }
        console.error("Failed to load publishing placeholders", error);
        setPlaceholderCatalog([]);
      } finally {
        if (alive) {
          setPlaceholderCatalogLoading(false);
        }
      }
    };
    void loadPlaceholders();
    return () => {
      alive = false;
    };
  }, [debouncedPlaceholderSearch]);

  useEffect(() => {
    let alive = true;
    const loadStyles = async () => {
      if (!template?.id) {
        setPlaceholderStyles([]);
        return;
      }
      try {
        const response = await publishingTemplatesApi.getPlaceholderStyles(template.id);
        if (alive) {
          setPlaceholderStyles(Array.isArray(response) ? response : []);
        }
      } catch (error) {
        if (alive) {
          console.error("Failed to load placeholder styles", error);
          setPlaceholderStyles([]);
        }
      }
    };
    void loadStyles();
    return () => {
      alive = false;
    };
  }, [template?.id, template?.versionNumber]);

  useEffect(() => {
    if (activeDetectedPlaceholders.length === 0) {
      setSelectedStylePlaceholder("");
      return;
    }
    const hasCurrent = activeDetectedPlaceholders.some(
      (item) => normalizePlaceholderKey(item) === normalizePlaceholderKey(selectedStylePlaceholder),
    );
    if (!hasCurrent) {
      setSelectedStylePlaceholder(activeDetectedPlaceholders[0] || "");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSlotMeta.key]);

  useEffect(() => {
    if (styleModalOpen) {
      setStyleForm(toStyleForm(modalStyleRecord?.style));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleModalOpen, modalStyleRecord?.id, modalStyleRecord?.updatedAt, selectedStylePlaceholder]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
      previewCacheRef.current.forEach((url) => URL.revokeObjectURL(url));
      previewCacheRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 1023px)");
    const syncViewport = () => setIsCompactViewport(mediaQuery.matches);

    syncViewport();
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncViewport);
      return () => mediaQuery.removeEventListener("change", syncViewport);
    }

    mediaQuery.addListener(syncViewport);
    return () => mediaQuery.removeListener(syncViewport);
  }, []);

  useEffect(() => {
    if (!slotPreviewKey) {
      return;
    }

    const [componentType, layoutPart] = slotPreviewKey.split(":");
    const normalizedComponentType = normalizeComponentType(componentType || "cover");
    const normalizedLayout = normalizeLayout(layoutPart);
    const slotState = getTemplateSlotState(
      template?.components,
      normalizedComponentType,
      normalizedLayout,
    );
    const stillExists = Boolean(
      slotState.fileName ||
        slotState.objectKey ||
        slotState.previewAvailable,
    );

    if (!stillExists) {
      setSlotPreviewUrl(null);
      setSlotPreviewKey(null);
      slotPreviewKeyRef.current = null;
    }
  }, [slotPreviewKey, template?.components]);

  useEffect(() => {
    if (configuredLayouts.length > 0) {
      const [currentComponentType] = activeSlot.split(":");
      const normalizedComponentType = normalizeComponentType(
        currentComponentType || "cover",
      );
      if (!requiredComponentTypes.includes(normalizedComponentType)) {
        setActiveSlot(getFallbackActiveSlot(template?.components));
        return;
      }
      const currentLayout = normalizeLayout(activeSlot.split(":")[1]);
      if (!configuredLayouts.includes(currentLayout)) {
        setActiveSlot(slotKey(normalizedComponentType, configuredLayouts[0]));
      }
    }
  }, [
    activeSlot,
    configuredLayouts,
    requiredComponentTypes,
    template?.components,
  ]);

  useEffect(() => {
    if (!template?.id || !hasInitializedModeRef.current) return;
    if (lastPublishingModeRef.current === form.publishingMode) return;

    const previousMode = lastPublishingModeRef.current;
    const nextMode = form.publishingMode;
    lastPublishingModeRef.current = nextMode;

    const removableSlots = (template.components || []).filter((item) => {
      const componentType = normalizeComponentType(
        String(item.componentType || ""),
      );
      return !requiredComponentTypes.includes(componentType);
    });

    if (removableSlots.length === 0) {
      setActiveSlot(getFallbackActiveSlot(template.components));
      return;
    }

    const runId = ++modeSyncRunRef.current;
    let cancelled = false;

    void (async () => {
      try {
        let latestTemplate = template;
        for (const item of removableSlots) {
          if (cancelled || runId !== modeSyncRunRef.current) return;
          const componentType = normalizeComponentType(
            String(item.componentType || "cover"),
          );
          const layout = normalizeLayout(item.layout);
          const key = slotKey(componentType, layout);
          latestTemplate = await publishingTemplatesApi.deleteComponent(
            template.id!,
            componentType,
            layout.toLowerCase() as "portrait" | "landscape",
          );
          if (cancelled || runId !== modeSyncRunRef.current) return;
          previewCacheRef.current.delete(key);
          slotPreviewSourceRef.current.delete(key);
          if (slotPreviewKeyRef.current === key) {
            previewUrlRef.current = null;
            setSlotPreviewUrl(null);
            slotPreviewKeyRef.current = null;
            setSlotPreviewKey(null);
          }
          setTemplate(latestTemplate);
        }

        if (cancelled || runId !== modeSyncRunRef.current) return;
        setTemplate((current) =>
          current
            ? { ...current, components: latestTemplate.components }
            : latestTemplate,
        );
        setActiveSlot(getFallbackActiveSlot(latestTemplate.components));
        showToast({
          type: "success",
          title: "Mode updated",
          message:
            "Slots outside the selected publishing mode were cleared automatically.",
        });
      } catch (error) {
        console.error(
          "Failed to clear slots for publishing mode change",
          error,
        );
        setForm((current) => ({ ...current, publishingMode: previousMode }));
        lastPublishingModeRef.current = previousMode;
        showToast({
          type: "error",
          title: "Mode update failed",
          message: "Unable to clear incompatible template files.",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    form.publishingMode,
    requiredComponentTypes,
    showToast,
    template,
  ]);

  useEffect(() => {
    if (!template?.id || isLoading) return;
    const { componentType, layout, key } = activeSlotMeta;
    const hasFile = Boolean(
      currentSlotState.fileName ||
      currentSlotState.objectKey ||
      currentSlotState.previewAvailable,
    );
    if (!hasFile) return;
    if (uploadingSlot === key) return;

    const hasFreshPreview =
      slotPreviewKeyRef.current === key &&
      previewUrlRef.current &&
      slotPreviewSourceRef.current.get(key) === activeSlotSourceSignature;
    if (hasFreshPreview) return;

    const timer = window.setTimeout(() => {
      if (!templateRef.current?.id) return;
      if (uploadingSlot === key) return;
      if (slotPreviewSourceRef.current.get(key) === activeSlotSourceSignature) return;
      void loadSlotPreview(
        componentType,
        layout,
        false,
        false,
        false,
        0,
        activeSlotSourceSignature,
      );
    }, 120);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    activeSlotMeta,
    activeSlotSourceSignature,
    currentSlotState.fileName,
    currentSlotState.objectKey,
    isLoading,
    uploadingSlot,
    template?.id,
  ]);

  const openStyleModal = (placeholder: string, componentType: ComponentType, layout: LayoutType) => {
    setSelectedStylePlaceholder(placeholder);
    setStyleModalSlot({ componentType, layout });
    setStyleModalOpen(true);
  };

  const handleSave = async (
    options?: { redirectAfterCreate?: boolean },
  ): Promise<PublishingTemplateResponse | null> => {
    setIsSaving(true);
    try {
      if (!form.templateName.trim()) {
        showToast({
          type: "warning",
          title: "Template Name required",
          message: "Template Name is required before saving.",
        });
        return null;
      }
      const payload = buildTemplatePayload();
      const saved =
        isEditMode && template?.id
          ? await publishingTemplatesApi.updateTemplate(template.id, payload)
          : await publishingTemplatesApi.createTemplate(payload);
      setTemplate(saved);
      showToast({
        type: "success",
        title: "Saved",
        message: "Publishing template saved successfully.",
      });
      if (options?.redirectAfterCreate !== false && !isEditMode && saved.id) {
        navigate(ROUTES.SETTINGS.PUBLISHING_TEMPLATES_EDIT(saved.id), {
          replace: true,
          state: locationState || undefined,
        });
      }
      return saved;
    } catch (error) {
      console.error("Failed to save publishing template", error);
      showToast({
        type: "error",
        title: "Save failed",
        message: "Unable to save publishing template.",
      });
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    setPublishConfirmOpen(false);
    setIsSaving(true);
    try {
      const draft = template?.id
        ? template
        : await handleSave({ redirectAfterCreate: false });
      if (!draft?.id) {
        return;
      }
      setTemplate(draft);
      const published = await publishingTemplatesApi.publishTemplate(
        draft.id,
        `Published publishing template "${draft.templateName || "Untitled Template"}" from template editor.`,
      );
      setTemplate(published);
      showToast({
        type: "success",
        title: "Published",
        message: "Publishing template published successfully.",
      });
    } catch (error) {
      console.error("Failed to publish publishing template", error);
      showToast({
        type: "error",
        title: "Publish failed",
        message: "Unable to publish template.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!template?.id) return;
    setIsSaving(true);
    try {
      await publishingTemplatesApi.deleteTemplate(template.id);
      showToast({
        type: "success",
        title: "Deleted",
        message: "Publishing template deleted.",
      });
      navigateTo(ROUTES.SETTINGS.PUBLISHING_TEMPLATES);
    } catch (error) {
      console.error("Failed to delete publishing template", error);
      showToast({
        type: "error",
        title: "Delete failed",
        message: "Unable to delete publishing template.",
      });
    } finally {
      setIsSaving(false);
      setDeleteTarget(null);
    }
  };

  const handleDuplicate = async () => {
    if (!template?.id) return;
    setIsSaving(true);
    try {
      const duplicated = await publishingTemplatesApi.duplicateTemplate(
        template.id,
      );
      setTemplate(duplicated);
      setForm({
        templateName: duplicated.templateName || "",
        description: duplicated.description || "",
        status: duplicated.status || "DRAFT",
        publishingMode: normalizePublishingMode(duplicated.publishingMode),
      });
      showToast({
        type: "success",
        title: "Duplicated",
        message: "Publishing template duplicated.",
      });
      navigate(ROUTES.SETTINGS.PUBLISHING_TEMPLATES_EDIT(duplicated.id || ""), {
        replace: true,
        state: locationState || undefined,
      });
    } catch (error) {
      console.error("Failed to duplicate publishing template", error);
      showToast({
        type: "error",
        title: "Duplicate failed",
        message: "Unable to duplicate template.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const ensureTemplateDraft = async () => {
    if (template?.id) {
      return template;
    }
    return await handleSave();
  };

  const loadSlotPreview = async (
    componentType: ComponentType,
    layout: LayoutType,
    forceRefresh = false,
    showErrorToast = true,
    showButtonSpinner = false,
    retryCount = 0,
    sourceSignature?: string,
    previewPlaceholder?: string,
    previewText?: string,
    previewFontSize?: number,
    exactPreview?: boolean,
  ) => {
    const templateId = templateRef.current?.id;
    if (!templateId) return;
    const key = slotKey(componentType, layout);
    const switchingSlot = slotPreviewKeyRef.current !== key;
    if (slotPreviewLoadingKeyRef.current === key && !forceRefresh) {
      setActiveSlot(key);
      return;
    }
    const requestId = ++previewLoadRequestRef.current;
    setActiveSlot(key);
    if ((switchingSlot || forceRefresh || !previewUrlRef.current) && slotPreviewLoadingKeyRef.current !== key) {
      slotPreviewLoadingKeyRef.current = key;
      setSlotPreviewLoadingKey(key);
    }
    if (showButtonSpinner) {
      setSlotPreviewButtonRefreshingKey(key);
    }
    const cachedUrl = previewCacheRef.current.get(key);
    if (cachedUrl) {
      previewUrlRef.current = cachedUrl;
      setSlotPreviewUrl(cachedUrl);
      slotPreviewKeyRef.current = key;
      setSlotPreviewKey(key);
      if (!forceRefresh) {
        if (previewLoadRequestRef.current === requestId) {
          window.requestAnimationFrame(() => {
            if (previewLoadRequestRef.current === requestId) {
              slotPreviewLoadingKeyRef.current = null;
              setSlotPreviewLoadingKey(null);
              if (showButtonSpinner) {
                setSlotPreviewButtonRefreshingKey(null);
              }
            }
          });
        }
        if (sourceSignature) {
          slotPreviewSourceRef.current.set(key, sourceSignature);
        }
        return;
      }
    }
    try {
      const blob = await publishingTemplatesApi.getComponentPreview(
        templateId,
        componentType,
        undefined,
        layout.toLowerCase() as "portrait" | "landscape",
        previewPlaceholder,
        previewText,
        previewFontSize,
        exactPreview,
      );
      const url = URL.createObjectURL(blob);
      previewUrlRef.current = url;
      previewCacheRef.current.set(key, url);
      if (sourceSignature) {
        slotPreviewSourceRef.current.set(key, sourceSignature);
      }
      setSlotPreviewUrl(url);
      slotPreviewKeyRef.current = key;
      setSlotPreviewKey(key);
      if (previewLoadRequestRef.current === requestId) {
        slotPreviewLoadingKeyRef.current = null;
        setSlotPreviewLoadingKey(null);
        if (showButtonSpinner) {
          setSlotPreviewButtonRefreshingKey(null);
        }
      }
    } catch (error) {
      console.error("Failed to load publishing component preview", error);
      if (!cachedUrl) {
        setSlotPreviewUrl(null);
      }
      if (retryCount < 1) {
        window.setTimeout(() => {
          void loadSlotPreview(
            componentType,
            layout,
            forceRefresh,
            showErrorToast,
            showButtonSpinner,
            retryCount + 1,
            sourceSignature,
            previewPlaceholder,
            previewText,
            previewFontSize,
            exactPreview,
          );
        }, 400);
        return;
      }
      if (showErrorToast) {
        showToast({
          type: "error",
          title: "Preview failed",
          message: "Unable to load template preview.",
        });
      }
    } finally {
      if (
        previewLoadRequestRef.current === requestId &&
        retryCount >= 1
      ) {
        slotPreviewLoadingKeyRef.current = null;
        setSlotPreviewLoadingKey(null);
        if (showButtonSpinner) {
          setSlotPreviewButtonRefreshingKey(null);
        }
      }
    }
  };

  const handleFileSelected = async (
    componentType: ComponentType,
    layout: LayoutType,
    file?: File | null,
  ) => {
    if (!file) return;
    const originalName = (file.name || "").toLowerCase();
    const isDocxFile =
      originalName.endsWith(".docx") ||
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (!isDocxFile) {
      showToast({
        type: "error",
        title: "Invalid file type",
        message: "Only .docx files are allowed for publishing templates.",
      });
      return;
    }
    const key = slotKey(componentType, layout);
    setUploadingSlot(key);
    try {
      const draft = await ensureTemplateDraft();
      if (!draft?.id) {
        return;
      }
      const updated = await publishingTemplatesApi.uploadComponent(
        draft.id,
        componentType,
        file,
        layout.toLowerCase() as "portrait" | "landscape",
      );
      setTemplate(updated);
      const uploadedState = getTemplateSlotState(
        updated.components,
        componentType,
        layout,
      );
      const uploadedSignature = [
        uploadedState.objectKey || "",
        uploadedState.checksum || "",
        uploadedState.fileName || "",
        uploadedState.uploadedAt || "",
      ].join("::");
      void loadSlotPreview(
        componentType,
        layout,
        true,
        false,
        false,
        0,
        uploadedSignature,
      );
      showToast({
        type: "success",
        title: "Uploaded",
        message: `${layoutLabel(layout)} ${componentType} template uploaded.`,
      });
    } catch (error) {
      console.error("Failed to upload publishing template component", error);
      showToast({
        type: "error",
        title: "Upload failed",
        message: "Unable to upload template file.",
      });
    } finally {
      setUploadingSlot(null);
      if (fileInputRefs.current[key]) {
        fileInputRefs.current[key]!.value = "";
      }
    }
  };

  const handleDeleteSlot = async () => {
    if (!template?.id || !deleteSlotTarget) return;
    const { componentType, layout } = deleteSlotTarget;
    const key = slotKey(componentType, layout);
    setDeletingSlot(key);
    try {
      previewCacheRef.current.delete(key);
      slotPreviewSourceRef.current.delete(key);
      const updated = await publishingTemplatesApi.deleteComponent(
        template.id,
        componentType,
        layout.toLowerCase() as "portrait" | "landscape",
      );
      setTemplate(updated);
      if (activeSlot === key || slotPreviewKeyRef.current === key) {
        previewUrlRef.current = null;
        setSlotPreviewUrl(null);
        slotPreviewKeyRef.current = null;
        setSlotPreviewKey(null);
      }
      showToast({
        type: "success",
        title: "Deleted",
        message: `${layoutLabel(layout)} ${componentType} template deleted.`,
      });
    } catch (error) {
      console.error("Failed to delete publishing template component", error);
      showToast({
        type: "error",
        title: "Delete failed",
        message: "Unable to delete template file.",
      });
    } finally {
      setDeletingSlot(null);
      setDeleteSlotTarget(null);
    }
  };

  const handleCopyPlaceholder = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedPlaceholder(value);
      window.setTimeout(() => {
        setCopiedPlaceholder((current) => (current === value ? null : current));
      }, 1200);
    } catch (error) {
      console.error("Failed to copy placeholder", error);
      showToast({
        type: "error",
        title: "Copy failed",
        message: "Unable to copy placeholder.",
      });
    }
  };

  const refreshPlaceholderStyles = async (templateId: string) => {
    const response = await publishingTemplatesApi.getPlaceholderStyles(templateId);
    setPlaceholderStyles(Array.isArray(response) ? response : []);
  };

  const handleSavePlaceholderStyle = async () => {
    if (!template?.id || !selectedStylePlaceholder) return;
    setIsSavingPlaceholderStyle(true);
    const placeholderKey = normalizePlaceholderKey(selectedStylePlaceholder);
    const placeholderType = inferPlaceholderType(selectedStylePlaceholder);
    try {
      await publishingTemplatesApi.savePlaceholderStyles(template.id, [
        {
          componentType: activeSlotMeta.componentType,
          layout: activeSlotMeta.layout.toLowerCase(),
          placeholderKey,
          placeholderToken: placeholderToken(selectedStylePlaceholder),
          placeholderType,
          style: {
            ...styleForm,
            transforms: placeholderType === "SIGNATURE" ? [] : styleForm.transforms || [],
            fontFamily: styleForm.fontFamily || null,
            fontSizePt:
              typeof styleForm.fontSizePt === "number" && Number.isFinite(styleForm.fontSizePt)
                ? styleForm.fontSizePt
                : null,
            color: styleForm.color || DEFAULT_BLACK_HEX,
            alignment: styleForm.alignment || null,
            dateFormat: placeholderType === "DATE" ? styleForm.dateFormat || null : null,
            numberFormat: placeholderType === "NUMBER" ? styleForm.numberFormat || null : null,
            preserveLineBreaks: styleForm.preserveLineBreaks ?? true,
            maxLines:
              typeof styleForm.maxLines === "number" && Number.isFinite(styleForm.maxLines)
                ? styleForm.maxLines
                : null,
          },
        },
      ]);
      await refreshPlaceholderStyles(template.id);
      previewCacheRef.current.delete(activeSlotMeta.key);
      await loadSlotPreview(
        activeSlotMeta.componentType,
        activeSlotMeta.layout,
        true,
        false,
        true,
        0,
        getSlotPreviewSourceSignature(
          currentSlotState,
          getSlotStyleSignature(activeSlotMeta.componentType, activeSlotMeta.layout),
        ),
      );
      showToast({ type: "success", title: "Style saved", message: "Placeholder style updated." });
    } catch (error) {
      console.error("Failed to save placeholder style", error);
      showToast({ type: "error", title: "Save failed", message: "Unable to save placeholder style." });
    } finally {
      setIsSavingPlaceholderStyle(false);
    }
  };

  const handleDeletePlaceholderStyle = async () => {
    if (!template?.id || !selectedStylePlaceholder) return;
    setIsSavingPlaceholderStyle(true);
    try {
      await publishingTemplatesApi.deletePlaceholderStyle(
        template.id,
        activeSlotMeta.componentType,
        activeSlotMeta.layout.toLowerCase(),
        normalizePlaceholderKey(selectedStylePlaceholder),
      );
      await refreshPlaceholderStyles(template.id);
      setStyleForm(DEFAULT_PLACEHOLDER_STYLE);
      previewCacheRef.current.delete(activeSlotMeta.key);
      await loadSlotPreview(
        activeSlotMeta.componentType,
        activeSlotMeta.layout,
        true,
        false,
        true,
        0,
        getSlotPreviewSourceSignature(
          currentSlotState,
          getSlotStyleSignature(activeSlotMeta.componentType, activeSlotMeta.layout),
        ),
      );
      showToast({ type: "success", title: "Style cleared", message: "Placeholder style removed." });
    } catch (error) {
      console.error("Failed to delete placeholder style", error);
      showToast({ type: "error", title: "Delete failed", message: "Unable to delete placeholder style." });
    } finally {
      setIsSavingPlaceholderStyle(false);
    }
  };

  if (isLoading) {
    return <FullPageLoading text="Loading publishing template editor..." />;
  }

  return (
    <div className="flex h-full flex-col gap-4 md:gap-6">
      {(isNavigating || isSaving) && (
        <FullPageLoading
          text={isSaving ? "Saving publishing template..." : "Navigating..."}
        />
      )}

      <AlertModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
        title="Delete Publishing Template"
        description={`Are you sure you want to delete "${deleteTarget?.templateName || template?.templateName || "this template"}"? This cannot be undone.`}
        confirmText="Delete"
        type="warning"
      />

      <AlertModal
        isOpen={!!deleteSlotTarget}
        onClose={() => setDeleteSlotTarget(null)}
        onConfirm={() => void handleDeleteSlot()}
        title="Delete Template File"
        description={`Are you sure you want to delete the ${deleteSlotTarget ? `${layoutLabel(deleteSlotTarget.layout)} ${deleteSlotTarget.componentType}` : "selected"} file? This cannot be undone.`}
        confirmText="Delete"
        type="warning"
      />

      <AlertModal
        isOpen={publishConfirmOpen}
        onClose={() => setPublishConfirmOpen(false)}
        onConfirm={() => void handlePublish()}
        title="Publish Template"
        description={
          template?.templateName
            ? `Publish "${template.templateName}" now? This will create a published version and record the action in the audit trail.`
            : "Publish this template now? This will create a published version and record the action in the audit trail."
        }
        confirmText="Publish"
        type="confirm"
        isLoading={isSaving}
      />

      {/* Placeholder Style Modal */}
      {createPortal(
        <AnimatePresence mode="wait">
          {styleModalOpen && styleModalSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-hidden"
          style={{
            paddingTop: 'max(1rem, env(safe-area-inset-top, 1rem))',
            paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))',
          }}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onClick={() => setStyleModalOpen(false)}
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
          />
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: "spring", damping: 25, stiffness: 350, duration: 0.3 }}
            className="relative z-10 w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl"
            style={{ maxHeight: 'calc(100dvh - 2rem)' }}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">
                  Placeholder Style
                </p>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  <span className="font-medium text-emerald-700">{placeholderToken(selectedStylePlaceholder)}</span>
                  {" · "}
                  {styleModalSlot.componentType.toUpperCase()} / {layoutLabel(styleModalSlot.layout)}
                  {" · "}
                  <span className="rounded bg-slate-100 px-1 py-0.5 text-2xs font-semibold uppercase text-slate-500">
                    {selectedPlaceholderType}
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                {modalStyleRecord ? <Badge color="emerald">Configured</Badge> : <Badge color="slate">Default Word style</Badge>}
                <button
                  type="button"
                  onClick={() => setStyleModalOpen(false)}
                  className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Modal body */}
            <div className="max-h-[70vh] overflow-y-auto p-5 space-y-5">
              {/* Typography */}
              <div>
                <p className="mb-2.5 text-2xs font-semibold uppercase tracking-wide text-slate-400">Typography</p>
                <div className="grid grid-cols-2 gap-3 items-end">
                  <Select
                    label="Font family"
                    value={styleForm.fontFamily || ""}
                    onChange={(value) => setStyleForm((c) => ({ ...c, fontFamily: String(value || "") }))}
                    options={FONT_FAMILY_OPTIONS}
                  />
                  <label className="space-y-1">
                    <span className={TYPOGRAPHY.formLabel}>Font size (pt)</span>
                    <Input
                      type="number"
                      min={1}
                      step="0.5"
                      value={styleForm.fontSizePt ?? ""}
                      onChange={(e) => setStyleForm((c) => ({ ...c, fontSizePt: e.target.value ? Number(e.target.value) : null }))}
                      placeholder="8.5"
                    />
                  </label>
                  <ColorPickerInput
                    label="Text color"
                    value={styleForm.color || DEFAULT_BLACK_HEX}
                    onChange={(color) => setStyleForm((c) => ({ ...c, color }))}
                  />
                  <div className="space-y-1">
                    <span className={TYPOGRAPHY.formLabel}>Alignment</span>
                    <div className="flex h-9 overflow-hidden rounded-lg border border-slate-200">
                      {([
                        { value: "LEFT", icon: AlignLeft, title: "Left" },
                        { value: "CENTER", icon: AlignCenter, title: "Center" },
                        { value: "RIGHT", icon: AlignRight, title: "Right" },
                        { value: "BOTH", icon: AlignJustify, title: "Justify" },
                      ] as { value: string; icon: React.ElementType; title: string }[]).map(({ value, icon: Icon, title }) => {
                        const active = styleForm.alignment === value;
                        return (
                          <button
                            key={value}
                            type="button"
                            title={title}
                            onClick={() => setStyleForm((c) => ({ ...c, alignment: active ? "" : value }))}
                            className={`flex flex-1 items-center justify-center border-r last:border-r-0 border-slate-200 transition-colors ${active ? "bg-emerald-50 text-emerald-600" : "bg-white text-slate-500 hover:bg-slate-50"}`}
                          >
                            <Icon className="h-4 w-4" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Formatting */}
              <div>
                <p className="mb-2 text-2xs font-semibold uppercase tracking-wide text-slate-400">Formatting</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-0 divide-y divide-slate-100">
                  {([
                    ["bold", "Bold"],
                    ["italic", "Italic"],
                    ["underline", "Underline"],
                    ["preserveLineBreaks", "Keep line breaks"],
                  ] as [keyof PublishingPlaceholderStyleConfig, string][]).map(([key, label]) => (
                    <label key={key} className="flex items-center justify-between gap-3 py-2 text-xs sm:text-sm font-medium text-slate-700">
                      <span>{label}</span>
                      <Switch
                        size="sm"
                        checked={Boolean(styleForm[key])}
                        onChange={(checked) => setStyleForm((c) => ({ ...c, [key]: checked }))}
                      />
                    </label>
                  ))}
                </div>
              </div>

              {/* Text processing */}
              <div>
                <p className="mb-2.5 text-2xs font-semibold uppercase tracking-wide text-slate-400">Text processing</p>
                <div className="grid grid-cols-2 gap-3 items-end">
                  <Select
                    label="Text transform"
                    value={styleForm.transforms?.[0] || "NONE"}
                    onChange={(value) => setStyleForm((c) => ({ ...c, transforms: String(value || "NONE") === "NONE" ? [] : [String(value)] }))}
                    options={TRANSFORM_OPTIONS}
                    disabled={isSignaturePlaceholder}
                  />
                  <Select
                    label="Date format"
                    value={styleForm.dateFormat || ""}
                    onChange={(value) => setStyleForm((c) => ({ ...c, dateFormat: String(value || "") }))}
                    options={DATE_FORMAT_OPTIONS}
                    disabled={selectedPlaceholderType !== "DATE"}
                  />
                  <Select
                    label="Number format"
                    value={styleForm.numberFormat || ""}
                    onChange={(value) => setStyleForm((c) => ({ ...c, numberFormat: String(value || "") }))}
                    options={NUMBER_FORMAT_OPTIONS}
                    disabled={selectedPlaceholderType !== "NUMBER"}
                  />
                  <label className="space-y-1">
                    <span className={TYPOGRAPHY.formLabel}>Max lines</span>
                    <Input
                      type="number"
                      min={1}
                      value={styleForm.maxLines ?? ""}
                      onChange={(e) => setStyleForm((c) => ({ ...c, maxLines: e.target.value ? Number(e.target.value) : null }))}
                      placeholder="No limit"
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleDeletePlaceholderStyle()}
                disabled={!modalStyleRecord || isSavingPlaceholderStyle}
                className="gap-2"
              >
                Clear style
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setStyleModalOpen(false)}
                className="gap-2"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={() => void handleSavePlaceholderStyle()}
                disabled={isSavingPlaceholderStyle || !template?.id}
                className="gap-2"
              >
                {isSavingPlaceholderStyle && <Loader2 className="h-4 w-4 animate-spin" />}
                Save style
              </Button>
            </div>
          </motion.div>
        </div>
          )}
        </AnimatePresence>,
        document.body,
      )}

      <PageHeader
        title={
          isEditMode ? "Edit Publishing Template" : "New Publishing Template"
        }
        breadcrumbItems={
          isEditMode
            ? publishingTemplateEdit(navigateTo, template?.templateName ?? undefined)
            : publishingTemplateCreate(navigateTo)
        }
        actions={
          <>
            <Button
              size="sm"
              variant="outline-emerald"
              onClick={handleBack}
              className="gap-2"
            >
              Back
            </Button>
            <Button
              size="sm"
              variant="outline-emerald"
              onClick={() => void handleSave()}
              className="gap-2"
            >
              Save Changes
            </Button>
            {isEditMode && (
              <>
                <Button
                  ref={getHeaderMenuRef("template-actions")}
                  size="sm"
                  variant="outline-emerald"
                  onClick={(event) => toggleHeaderMenu("template-actions", event)}
                  className="gap-2"
                >
                  More actions
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform duration-200",
                      openHeaderMenuId === "template-actions" && "rotate-180",
                    )}
                  />
                </Button>
                <PortalDropdownMenu
                  isOpen={openHeaderMenuId === "template-actions"}
                  onClose={closeHeaderMenu}
                  position={headerMenuPosition}
                  minWidth={180}
                >
                  <div className="py-1">
                    <button
                      onClick={() => {
                        closeHeaderMenu();
                        handleDuplicate();
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 active:bg-slate-100 transition-colors"
                    >
                      <Copy className="h-4 w-4 flex-shrink-0" />
                      <span className="font-medium text-slate-500">Duplicate</span>
                    </button>
                    {template?.id && (
                      <button
                        onClick={() => {
                          closeHeaderMenu();
                          setPublishConfirmOpen(true);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 active:bg-slate-100 transition-colors"
                      >
                        <Send className="h-4 w-4 flex-shrink-0" />
                        <span className="font-medium text-slate-500">Publish Template</span>
                      </button>
                    )}
                    <button
                      onClick={() => {
                        closeHeaderMenu();
                        setDeleteTarget(template);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 active:bg-rose-100 transition-colors"
                    >
                      <Trash2 className="h-4 w-4 flex-shrink-0" />
                      <span className="font-medium">Delete</span>
                    </button>
                  </div>
                </PortalDropdownMenu>
              </>
            )}
          </>
        }
      />

      <div className="flex flex-col gap-4 lg:gap-6 xl:flex-row xl:items-start">
        <div className="min-w-0 space-y-4 xl:flex-1">
          <FormSection
            title="General Information"
            icon={<IconInfoCircle className="h-4 w-4" />}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={COMPONENT_PRESETS.formLabel}>
                  Template Name <span className="text-rose-600">*</span>
                </label>
                <Input
                  value={form.templateName}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      templateName: e.target.value,
                    }))
                  }
                  placeholder="Enter template name"
                  required
                />
              </div>
              <div>
                <label className={COMPONENT_PRESETS.formLabel}>
                  Version Template
                </label>
                <Input
                  value={String(template?.versionNumber ?? 1)}
                  readOnly
                  disabled
                  aria-readonly="true"
                  className="bg-slate-50 text-slate-700"
                />
              </div>
              <div>
                <label className={COMPONENT_PRESETS.formLabel}>Status</label>
                <Select
                  value={form.status}
                  onChange={(value) =>
                    setForm((prev) => ({ ...prev, status: String(value) }))
                  }
                  options={[
                    { value: "DRAFT", label: "Draft" },
                    { value: "ACTIVE", label: "Active" },
                    { value: "INACTIVE", label: "Inactive" },
                  ]}
                  placeholder="Select status"
                />
              </div>
              <div>
                <label className={COMPONENT_PRESETS.formLabel}>
                  Publishing Mode
                </label>
                <Select
                  value={form.publishingMode}
                  onChange={(value) =>
                    setForm((prev) => ({
                      ...prev,
                      publishingMode: normalizePublishingMode(String(value)),
                    }))
                  }
                  options={PUBLISHING_MODE_OPTIONS}
                  placeholder="Select publishing mode"
                />
              </div>
            </div>
          </FormSection>

          <FormSection
            title="Template Layout Uploads"
            icon={<GalleryHorizontalEnd className="h-4 w-4" />}
          >
            <div className="space-y-4">
              {visibleSlotGroups.map((group) => (
                <div
                  key={group.componentType}
                  className={cn(
                    BORDER_RADIUS.card,
                    COLORS.bg.secondary,
                    "border border-slate-200",
                  )}
                >
                  <div
                    className={cn("px-4 py-3", COLORS.border.dividerEmphasis)}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className={TYPOGRAPHY.cardSectionTitle}>
                          {group.title}
                        </p>
                        <p className={cn(TYPOGRAPHY.helpText, "hidden sm:block")}>{group.help}</p>
                      </div>
                      <Badge color="blue">
                        {PUBLISHING_MODE_OPTIONS.find(
                          (o) => o.value === form.publishingMode,
                        )?.label ?? form.publishingMode}
                      </Badge>
                    </div>
                  </div>
                  <div
                    className={cn("grid gap-3", PADDING.card, "sm:grid-cols-2")}
                  >
                    {(["PORTRAIT", "LANDSCAPE"] as LayoutType[]).map(
                      (layout) => {
                        const key = slotKey(group.componentType, layout);
                        const state = getTemplateSlotState(
                          template?.components,
                          group.componentType,
                          layout,
                        );
                        const isActive = activeSlot === key;
                        const hasFile = Boolean(
                          state.fileName || state.objectKey,
                        );
                        return (
                          <div
                            key={key}
                            className={cn(
                              BORDER_RADIUS.card,
                              COLORS.bg.primary,
                              SHADOW.sm,
                              "border p-3 transition sm:p-4",
                              isActive
                                ? "border-emerald-300 ring-1 ring-emerald-200"
                                : "border-slate-200",
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className={TYPOGRAPHY.cardSectionTitle}>
                                    {layoutLabel(layout)} Layout
                                  </p>
                                  <Badge color={hasFile ? "emerald" : "slate"}>
                                    {hasFile ? "Configured" : "Missing"}
                                  </Badge>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => setActiveSlot(key)}
                                className={cn(
                                  "inline-flex h-8 w-8 items-center justify-center rounded-lg border transition",
                                  isActive
                                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                                    : "border-slate-200 bg-white text-slate-500 hover:border-emerald-200",
                                )}
                                title="Focus preview"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                            </div>

                            <div className="mt-1 space-y-3">
                              <div>
                                <p className={TYPOGRAPHY.subDetail}>File</p>
                                <div className="mt-1 flex items-start justify-between gap-2">
                                  <p className="min-w-0 break-words text-xs sm:text-sm font-medium text-slate-700">
                                    {state.fileName || "No file uploaded"}
                                  </p>
                                  {hasFile && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setDeleteSlotTarget({
                                          componentType: group.componentType,
                                          layout,
                                        })
                                      }
                                      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-400 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                                      title="Delete uploaded file"
                                      aria-label="Delete uploaded file"
                                      disabled={
                                        isSaving ||
                                        uploadingSlot === key ||
                                        deletingSlot === key ||
                                        slotPreviewLoadingKey === key
                                      }
                                    >
                                      {deletingSlot === key ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <Trash2 className="h-3.5 w-3.5" />
                                      )}
                                    </button>
                                  )}
                                </div>
                                {state.uploadedBy && (
                                  <p className="mt-1 text-xs text-slate-500">
                                    Uploaded by {state.uploadedBy}
                                    {state.uploadedAt
                                      ? ` - ${new Date(state.uploadedAt).toLocaleString()}`
                                      : ""}
                                  </p>
                                )}
                              </div>

                              <div className="flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  variant="outline-emerald"
                                  className="gap-2"
                                  onClick={() =>
                                    fileInputRefs.current[key]?.click()
                                  }
                                  disabled={
                                    !template?.id ||
                                    isSaving ||
                                    uploadingSlot === key ||
                                    deletingSlot === key
                                  }
                                  title={
                                    !template?.id
                                      ? "Save the template first before uploading"
                                      : undefined
                                  }
                                >
                                  {uploadingSlot === key ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Upload className="h-4 w-4" />
                                  )}
                                  Upload
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline-emerald"
                                  className="gap-2"
                                  onClick={() =>
                                    void loadSlotPreview(
                                      group.componentType,
                                      layout,
                                      false,
                                      true,
                                      false,
                                      0,
                                      getSlotPreviewSourceSignature(
                                        state,
                                        getSlotStyleSignature(group.componentType, layout),
                                      ),
                                    )
                                  }
                                  disabled={
                                    !hasFile ||
                                    isSaving ||
                                    deletingSlot === key
                                  }
                                >
                                  <Wand2 className="h-4 w-4" />
                                  Preview
                                </Button>
                              </div>

                              <input
                                ref={(el) => {
                                  fileInputRefs.current[key] = el;
                                }}
                                type="file"
                  accept=".docx"
                                className="hidden"
                                onChange={(e) =>
                                  void handleFileSelected(
                                    group.componentType,
                                    layout,
                                    e.target.files?.[0],
                                  )
                                }
                              />

                              <div
                                className={cn(
                                  BORDER_RADIUS.formElement,
                                  "border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-600",
                                )}
                              >
                                <p className={TYPOGRAPHY.cardSectionTitle}>
                                  Detected placeholders
                                </p>
                                <p className="mt-1 text-2xs text-slate-400">Click a placeholder to edit its style.</p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {(state.detectedPlaceholders || []).length >
                                  0 ? (
                                    state.detectedPlaceholders!.map((item) => {
                                      const pKey = normalizePlaceholderKey(item);
                                      const hasStyle = placeholderStyles.some(
                                        (s) =>
                                          normalizeComponentType(String(s.componentType || "")) === group.componentType &&
                                          normalizeLayout(s.layout) === layout &&
                                          normalizePlaceholderKey(s.placeholderKey) === pKey,
                                      );
                                      return (
                                        <button
                                          key={item}
                                          type="button"
                                          title="Click to edit style"
                                          onClick={() => openStyleModal(item, group.componentType, layout)}
                                          className={cn(
                                            "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-2xs font-medium transition select-none cursor-pointer",
                                            hasStyle
                                              ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                                              : "border-slate-200 bg-white text-slate-700 hover:border-emerald-200 hover:bg-emerald-50",
                                          )}
                                        >
                                          {item}
                                          {hasStyle && <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                                        </button>
                                      );
                                    })
                                  ) : (
                                    <span className="text-slate-400">
                                      No placeholders detected yet.
                                    </span>
                                  )}
                                </div>
                              </div>

                            </div>
                          </div>
                        );
                      },
                    )}
                  </div>
                </div>
              ))}
            </div>
          </FormSection>

          <FormSection
            title="Available Placeholders"
            icon={<Copy className="h-4 w-4" />}
          >
            <div className="space-y-3">
              <div
                className={cn(
                  BORDER_RADIUS.card,
                  "border border-emerald-200 bg-emerald-50 p-3 text-xs sm:text-sm text-slate-600",
                )}
              >
                Use clean placeholders in Word, then configure casing, font,
                size, alignment, and other display rules in{" "}
                <span className="font-semibold text-slate-900">
                  Placeholder Style Manager
                </span>
                . This keeps the DOCX template readable and lets Admin adjust
                formatting without downloading and re-uploading the file.
                <div className="mt-2 flex flex-wrap gap-2 text-xs font-medium text-slate-700">
                  {["{{documentName}}", "{{titleLocalLanguage}}", "{{authorName}}", "{{documentType}}"].map((token) => (
                    <span key={token} className="rounded-full border border-slate-200 bg-white px-2 py-1">{token}</span>
                  ))}
                </div>
              </div>

              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                  <Search className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  value={placeholderSearch}
                  onChange={(event) => setPlaceholderSearch(event.target.value)}
                  placeholder="Search placeholders by name or description..."
                  className="block h-9 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-9 text-sm placeholder:text-slate-400 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                {placeholderSearch && (
                  <button
                    type="button"
                    onClick={() => setPlaceholderSearch("")}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {!placeholderSearch.trim() && (
                <button
                  type="button"
                  onClick={() => setPlaceholderCatalogExpanded((prev) => !prev)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm font-medium text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50"
                >
                  <span>
                    {placeholderCatalogExpanded ? "Hide placeholder catalog" : "Browse all placeholders"}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-slate-400 transition-transform duration-300",
                      placeholderCatalogExpanded && "rotate-180",
                    )}
                  />
                </button>
              )}

              {(placeholderCatalogExpanded || placeholderSearch.trim()) && (
                placeholderCatalogLoading ? (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                  Loading placeholders from server...
                </div>
              ) : placeholderCatalog.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                  {placeholderSearch.trim()
                    ? `No placeholders match "${placeholderSearch.trim()}".`
                    : "No placeholder catalog is available yet."}
                </div>
              ) : (
                <div className="space-y-2">
                  {placeholderCatalog.map((group, groupIndex) => {
                    const isOpen = openAccordionGroups.has(groupIndex);
                    const toggleGroup = () =>
                      setOpenAccordionGroups((prev) => {
                        const next = new Set(prev);
                        if (next.has(groupIndex)) next.delete(groupIndex);
                        else next.add(groupIndex);
                        return next;
                      });
                    return (
                      <div
                        key={group.title || `placeholder-group-${groupIndex}`}
                        className={cn(BORDER_RADIUS.card, COLORS.bg.secondary, "border border-slate-200 overflow-hidden")}
                      >
                        {/* Accordion header */}
                        <button
                          type="button"
                          onClick={toggleGroup}
                          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-100/70"
                        >
                          <div className="min-w-0">
                            <p className={TYPOGRAPHY.cardSectionTitle}>{group.title}</p>
                            <p className={cn(TYPOGRAPHY.helpText, "hidden sm:block mt-0.5")}>{group.description}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <Badge color="slate">{(group.items || []).length}</Badge>
                            <ChevronDown
                              className={cn(
                                "h-4 w-4 text-slate-400 transition-transform duration-300",
                                isOpen && "rotate-180",
                              )}
                            />
                          </div>
                        </button>

                        {/* Accordion body */}
                        <AnimatePresence initial={false}>
                          {isOpen && (
                            <motion.div
                              key="content"
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ type: "spring", stiffness: 90, damping: 16 }}
                              className="overflow-hidden"
                            >
                              <div className="grid gap-2 border-t border-slate-200 bg-white p-4 sm:grid-cols-2 xl:grid-cols-3">
                                {(group.items || []).map((item, itemIndex) => {
                                  const value = item.value || "";
                                  const description = item.description || "";
                                  const isCopied = copiedPlaceholder === value;
                                  return (
                                    <div
                                      key={value || `placeholder-item-${groupIndex}-${itemIndex}`}
                                      role="button"
                                      tabIndex={0}
                                      onClick={() => void handleCopyPlaceholder(value)}
                                      onKeyDown={(event) => {
                                        if (event.key === "Enter" || event.key === " ") {
                                          event.preventDefault();
                                          void handleCopyPlaceholder(value);
                                        }
                                      }}
                                      className={cn(
                                        "flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition focus:outline-none focus:ring-2 focus:ring-emerald-200",
                                        isCopied
                                          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                                          : "border-slate-200 bg-white text-slate-700 hover:border-emerald-200 hover:bg-emerald-50/40",
                                      )}
                                    >
                                      <span className="min-w-0 break-all text-xs font-medium">{value}</span>
                                      <span className="flex shrink-0 items-center gap-1.5">
                                        <Popover
                                          content={description}
                                          triggerAriaLabel={description}
                                          trigger={<Info className="h-3.5 w-3.5 text-slate-400" />}
                                          triggerClassName="text-slate-400 hover:text-emerald-700"
                                        />
                                        <AnimatePresence mode="wait" initial={false}>
                                          {isCopied ? (
                                            <motion.span
                                              key="check"
                                              initial={{ scale: 0, opacity: 0 }}
                                              animate={{ scale: 1, opacity: 1 }}
                                              exit={{ scale: 0, opacity: 0 }}
                                              transition={{ duration: 0.15 }}
                                              className="ml-2 flex shrink-0 items-center"
                                            >
                                              <Check className="h-4 w-4 text-emerald-600" />
                                            </motion.span>
                                          ) : (
                                            <motion.span
                                              key="copy"
                                              initial={{ scale: 0, opacity: 0 }}
                                              animate={{ scale: 1, opacity: 1 }}
                                              exit={{ scale: 0, opacity: 0 }}
                                              transition={{ duration: 0.15 }}
                                              className="ml-2 flex shrink-0 items-center"
                                            >
                                              <Copy className="h-4 w-4 text-slate-400" />
                                            </motion.span>
                                          )}
                                        </AnimatePresence>
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </FormSection>
        </div>

        <div className="min-w-0 space-y-4 xl:sticky xl:top-4 xl:w-[42%] xl:shrink-0 xl:self-start">
          <FormSection title="Live Preview" icon={<Eye className="h-4 w-4" />}>
            <div className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className={TYPOGRAPHY.cardSectionTitle}>
                    {activeSlotMeta.componentType.charAt(0).toUpperCase() +
                      activeSlotMeta.componentType.slice(1)}{" "}
                    - {layoutLabel(activeSlotMeta.layout)}
                  </p>
                  <p className={cn(TYPOGRAPHY.subDetail, "break-words")}>
                    {currentSlotState.fileName || "No file uploaded"}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline-emerald"
                  className="w-full gap-2 sm:w-auto"
                  onClick={() =>
                    void loadSlotPreview(
                      activeSlotMeta.componentType,
                      activeSlotMeta.layout,
                      true,
                      true,
                      true,
                      0,
                      getSlotPreviewSourceSignature(
                        currentSlotState,
                        getSlotStyleSignature(activeSlotMeta.componentType, activeSlotMeta.layout),
                      ),
                    )
                  }
                  disabled={
                    !currentSlotState.fileName && !currentSlotState.objectKey
                  }
                >
                  <RefreshCw className={cn("h-4 w-4 shrink-0", slotPreviewButtonRefreshingKey === activeSlotMeta.key && "animate-spin")} />
                  Reload Preview
                </Button>
              </div>

              {activeSlotPreviewUrl ? (
                <>
                  <div
                    className={cn(
                      COLORS.bg.primary,
                      "overflow-hidden border border-slate-200",
                    )}
                  >
                    <DocumentPdfViewer
                      fileUrl={activeSlotPreviewUrl}
                      height={
                        isCompactViewport
                          ? "clamp(420px, 72vh, 620px)"
                          : "clamp(560px, calc(100vh - 330px), 980px)"
                      }
                      minHeight={isCompactViewport ? "420px" : "560px"}
                      showThumbnailSidebar={!isCompactViewport}
                      thumbnailSidebarWidth={isCompactViewport ? 180 : 220}
                      isLoading={slotPreviewLoadingKey === activeSlotMeta.key}
                    />
                  </div>
                </>
              ) : (
                <div
                  className={cn(
                    BORDER_RADIUS.card,
                    COLORS.bg.secondary,
                    "flex min-h-[420px] items-center justify-center border border-dashed border-slate-300 text-center sm:min-h-[560px]",
                  )}
                >
                  <div className="max-w-sm space-y-2 p-6">
                    <p className="text-sm font-medium text-slate-800">
                      No preview loaded yet
                    </p>
                    <p className="text-xs text-slate-500">
                      Upload only a .docx file and click Preview to render the
                      selected slot here.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </FormSection>
        </div>
      </div>
    </div>
  );
};
