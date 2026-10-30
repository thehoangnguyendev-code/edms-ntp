import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { IconFileExport } from "@tabler/icons-react";
import pdfLogo from "@/assets/images/logo-app/pdf.png";
import wordLogo from "@/assets/images/logo-app/word.png";
import { Button } from "@/components/ui/button/Button";
import { PortalDropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown";
import { useToast } from "@/components/ui/toast/Toast";
import { usePortalDropdown } from "@/hooks/usePortalDropdown";
import {
  trainingError,
  type TrainingFormFormat,
} from "@/services/api/trainingActivities";
import { saveBlob } from "./trainingLabels";

/**
 * The Export button of a form of the company: one button that opens the choice of PDF File or Word File. The file is written by the server in the Word template that Training Administration
 * enabled, so what the screen offers is what the procedure asks for. A refusal of the server (no template enabled, not approved yet) is shown as it is.
 */
export function FormDownloadButtons({
  load,
  fileName,
  label,
  buttonText = "Export",
}: {
  load: (format: TrainingFormFormat) => Promise<Blob>;
  fileName: (format: TrainingFormFormat) => string;
  label?: string;
  /** The text of the button, when several forms of the same kind are offered side by side (for example one list for each department). */
  buttonText?: string;
}) {
  const { showToast } = useToast();
  const menu = usePortalDropdown();
  const [busy, setBusy] = useState<TrainingFormFormat | "">("");
  const download = async (format: TrainingFormFormat) => {
    setBusy(format);
    try {
      saveBlob(await load(format), fileName(format));
    } catch (e) {
      showToast({
        type: "error",
        title: `${label ?? "The form"} was not exported`,
        message: trainingError(e),
      });
    } finally {
      setBusy("");
    }
  };
  return (
    <>
      <Button
        ref={menu.getRef("export")}
        size="sm"
        variant="outline-emerald"
        className="gap-1 whitespace-nowrap pl-4 pr-2.5 md:pl-4 md:pr-2.5"
        loading={!!busy}
        disabled={!!busy}
        aria-haspopup="menu"
        aria-expanded={menu.openId === "export"}
        onClick={(event) =>
          menu.toggle("export", event, { menuHeight: 96, menuWidth: 180 })
        }
      >
        {buttonText}
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform duration-200 ${menu.openId === "export" ? "rotate-180" : ""}`}
        />
      </Button>
      <PortalDropdownMenu
        isOpen={menu.openId === "export"}
        onClose={menu.close}
        position={menu.position}
        minWidth={180}
      >
        <div className="py-1">
          <DropdownMenuItem
            icon={<img src={pdfLogo} alt="" className="h-4 w-4 object-contain" />}
            onClick={() => {
              menu.close();
              void download("pdf");
            }}
          >
            PDF File (.pdf)
          </DropdownMenuItem>
          <DropdownMenuItem
            icon={<img src={wordLogo} alt="" className="h-4 w-4 object-contain" />}
            onClick={() => {
              menu.close();
              void download("docx");
            }}
          >
            Word File (.docx)
          </DropdownMenuItem>
        </div>
      </PortalDropdownMenu>
    </>
  );
}
