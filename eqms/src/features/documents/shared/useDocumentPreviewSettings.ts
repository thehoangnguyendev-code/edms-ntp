import { useEffect, useState } from "react";
import { SECURITY_CONFIG_STORAGE_KEY } from "@/config/security";

interface SystemConfigLike {
  documents?: {
    allowDownload?: boolean;
  };
}

const readAllowDownloadSetting = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const raw = window.localStorage.getItem(SECURITY_CONFIG_STORAGE_KEY);
    if (!raw) {
      return false;
    }

    const parsed = JSON.parse(raw) as SystemConfigLike;
    return Boolean(parsed.documents?.allowDownload);
  } catch {
    return false;
  }
};

export const useDocumentPreviewSettings = () => {
  const [allowDownloadAndPrint, setAllowDownloadAndPrint] = useState<boolean>(() =>
    readAllowDownloadSetting(),
  );

  useEffect(() => {
    const syncFromStorage = () => {
      setAllowDownloadAndPrint(readAllowDownloadSetting());
    };

    syncFromStorage();

    const handleSecurityConfigUpdated = () => {
      syncFromStorage();
    };

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === SECURITY_CONFIG_STORAGE_KEY) {
        syncFromStorage();
      }
    };

    window.addEventListener("eqms:security-config-updated", handleSecurityConfigUpdated);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("eqms:security-config-updated", handleSecurityConfigUpdated);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  return { allowDownloadAndPrint };
};
