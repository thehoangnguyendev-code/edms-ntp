import apiClient from "./client";

/** What can carry a watermark. Machine values; the labels are on the screens. */
export type ImageWatermarkTarget = "controlledCopyEvidence" | "specimenSignature";

export type ImageWatermarkPosition = "TOP_LEFT" | "TOP_RIGHT" | "BOTTOM_LEFT" | "BOTTOM_RIGHT";

/** A picture stamped by the server, and what the server said about it. */
export interface WatermarkPreview {
  blob: Blob;
  /** False when the picture came back as it was: the target is switched off, or the picture is too small. */
  applied: boolean;
  note?: string;
}

const toPreview = (response: { data: Blob; headers: Record<string, unknown> }): WatermarkPreview => ({
  blob: response.data,
  applied: String(response.headers["x-watermark-applied"]) === "true",
  note: response.headers["x-watermark-note"] ? String(response.headers["x-watermark-note"]) : undefined,
});

/** The preview is made by the same code as a real upload, so what is shown is what the server would keep. Nothing is stored. */
export const imageWatermarkApi = {
  /** Settings that are not saved yet, on a sample or on a picture the administrator chose (Settings > Configuration > Image Watermark). */
  configPreview: async (target: ImageWatermarkTarget, settings: unknown, file?: File | null): Promise<WatermarkPreview> => {
    const form = new FormData();
    form.append("target", target);
    form.append("settings", JSON.stringify(settings));
    if (file) form.append("file", file);
    return toPreview(await apiClient.post<Blob>("/image-watermark/config-preview", form, { headers: { "Content-Type": "multipart/form-data" }, responseType: "blob" }));
  },
  /** The stamp that the saved settings would put on the picture the user is about to upload. */
  uploadPreview: async (target: ImageWatermarkTarget, file: File): Promise<WatermarkPreview> => {
    const form = new FormData();
    form.append("target", target);
    form.append("file", file);
    return toPreview(await apiClient.post<Blob>("/image-watermark/upload-preview", form, { headers: { "Content-Type": "multipart/form-data" }, responseType: "blob" }));
  },
};
