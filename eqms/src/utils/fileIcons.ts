/**
 * Centralized file icon utility.
 * Maps file extensions to their corresponding icon images from assets/images/image-file/.
 * 
 * Usage:
 *   import { getFileIconSrc } from "@/utils/fileIcons";
 *   <img src={getFileIconSrc("report.pdf")} alt="file icon" />
 *   <img src={getFileIconSrc("data.xlsx")} alt="file icon" />
 */

// ── Document icons ──
import pdfIcon from "@/assets/images/image-file/pdf.png";
import docIcon from "@/assets/images/image-file/doc.png";
import docxIcon from "@/assets/images/image-file/docx.png";
import xlsIcon from "@/assets/images/image-file/xls.png";
import xlsxIcon from "@/assets/images/image-file/xlsx.png";
import pptIcon from "@/assets/images/image-file/ppt.png";
import pptxIcon from "@/assets/images/image-file/pptx.png";
import csvIcon from "@/assets/images/image-file/csv.png";
import txtIcon from "@/assets/images/image-file/txt.png";
import xmlIcon from "@/assets/images/image-file/xml.png";
import htmlIcon from "@/assets/images/image-file/html.png";

// ── Image icons ──
import jpgIcon from "@/assets/images/image-file/jpg.png";
import jpegIcon from "@/assets/images/image-file/jpeg.png";
import pngIcon from "@/assets/images/image-file/png.png";
import gifIcon from "@/assets/images/image-file/gif.png";
import bmpIcon from "@/assets/images/image-file/bmp.png";
import svgIcon from "@/assets/images/image-file/svg.png";
import tiffIcon from "@/assets/images/image-file/tiff.png";
import psdIcon from "@/assets/images/image-file/psd.png";
import rawIcon from "@/assets/images/image-file/raw.png";
import epsIcon from "@/assets/images/image-file/eps.png";
import aiIcon from "@/assets/images/image-file/ai.png";

// ── Video / Audio icons ──
import mp4Icon from "@/assets/images/image-file/mp4.png";
import aviIcon from "@/assets/images/image-file/avi.png";
import movIcon from "@/assets/images/image-file/mov.png";
import flvIcon from "@/assets/images/image-file/flv.png";
import mpegIcon from "@/assets/images/image-file/mpeg.png";
import mp3Icon from "@/assets/images/image-file/mp3.png";
import wavIcon from "@/assets/images/image-file/wav.png";
import wmaIcon from "@/assets/images/image-file/wma.png";
import midIcon from "@/assets/images/image-file/mid.png";

// ── Archive / System icons ──
import zipIcon from "@/assets/images/image-file/zip.png";
import rarIcon from "@/assets/images/image-file/rar.png";
import isoIcon from "@/assets/images/image-file/iso.png";
import exeIcon from "@/assets/images/image-file/exe.png";
import dllIcon from "@/assets/images/image-file/dll.png";

// ── Other icons ──
import dwgIcon from "@/assets/images/image-file/dwg.png";
import pubIcon from "@/assets/images/image-file/pub.png";
import mdbIcon from "@/assets/images/image-file/mdb.png";
import javaIcon from "@/assets/images/image-file/java.png";
import crdIcon from "@/assets/images/image-file/crd.png";
import psIcon from "@/assets/images/image-file/ps.png";
import rssIcon from "@/assets/images/image-file/rss.png";

// ── Fallback ──
import fileIcon from "@/assets/images/image-file/file.png";

/** Complete extension → icon mapping (44 file types) */
const FILE_ICON_MAP: Record<string, string> = {
    // Documents
    pdf: pdfIcon,
    doc: docIcon,
    docx: docxIcon,
    xls: xlsIcon,
    xlsx: xlsxIcon,
    ppt: pptIcon,
    pptx: pptxIcon,
    csv: csvIcon,
    txt: txtIcon,
    xml: xmlIcon,
    html: htmlIcon,

    // Images
    jpg: jpgIcon,
    jpeg: jpegIcon,
    png: pngIcon,
    gif: gifIcon,
    bmp: bmpIcon,
    svg: svgIcon,
    tiff: tiffIcon,
    psd: psdIcon,
    raw: rawIcon,
    eps: epsIcon,
    ai: aiIcon,

    // Video
    mp4: mp4Icon,
    avi: aviIcon,
    mov: movIcon,
    flv: flvIcon,
    mpeg: mpegIcon,

    // Audio
    mp3: mp3Icon,
    wav: wavIcon,
    wma: wmaIcon,
    mid: midIcon,

    // Archive / System
    zip: zipIcon,
    rar: rarIcon,
    iso: isoIcon,
    exe: exeIcon,
    dll: dllIcon,

    // Other
    dwg: dwgIcon,
    pub: pubIcon,
    mdb: mdbIcon,
    java: javaIcon,
    crd: crdIcon,
    ps: psIcon,
    rss: rssIcon,
};

/**
 * Get the icon image source for a given file name or extension.
 * @param fileName - Full file name (e.g. "report.pdf") or just extension (e.g. "pdf")
 * @returns Icon image source path
 */
export const getFileIconSrc = (fileName: string): string => {
    const ext = fileName.includes(".")
        ? fileName.split(".").pop()?.toLowerCase() || ""
        : fileName.toLowerCase();
    return FILE_ICON_MAP[ext] || fileIcon;
};

/** The generic fallback file icon */
export { fileIcon as defaultFileIcon };

/** The full icon map (for advanced usage) */
export { FILE_ICON_MAP };
