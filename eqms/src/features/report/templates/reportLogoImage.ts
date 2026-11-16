/** The biggest picture that may be chosen; it is reduced before it goes into the layout. */
export const LOGO_MAX_UPLOAD = 10 * 1024 * 1024;
/** What the layout keeps: the server takes a picture of up to 1 MB and 4 megapixels, and a report needs far less than that. */
const LOGO_MAX_SIDE = 1600;
const LOGO_MAX_PIXELS = 3_000_000;
const LOGO_MAX_DATA_URL = 1_300_000;

/**
 * Reads a logo as a data URL that the layout can keep. A picture that is too big in pixels or in bytes is reduced step by step (the sides by a fifth each time,
 * a photograph in JPEG when the PNG stays too heavy) until it fits; its proportions and transparency are kept. Where the picture cannot be measured
 * (no canvas) it is used as it is when it is small enough, otherwise refused.
 */
export function readLogo(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read"));
    reader.onload = () => {
      const source = String(reader.result);
      const image = new Image();
      image.onerror = () => reject(new Error("image"));
      image.onload = () => {
        const width = image.naturalWidth;
        const height = image.naturalHeight;
        const fits = (data: string) => data.length <= LOGO_MAX_DATA_URL;
        if (!width || !height || (width * height <= LOGO_MAX_PIXELS && Math.max(width, height) <= 4096 && fits(source))) {
          if (fits(source)) resolve(source);
          else reject(new Error("size"));
          return;
        }
        let scale = Math.min(1, LOGO_MAX_SIDE / Math.max(width, height), Math.sqrt(LOGO_MAX_PIXELS / (width * height)));
        for (let attempt = 0; attempt < 10; attempt++) {
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(width * scale));
          canvas.height = Math.max(1, Math.round(height * scale));
          const context = canvas.getContext("2d");
          if (!context) {
            reject(new Error("canvas"));
            return;
          }
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          const png = canvas.toDataURL("image/png");
          if (fits(png)) {
            resolve(png);
            return;
          }
          // A heavy PNG is usually a photograph: JPEG is much smaller (transparency becomes white).
          if (file.type === "image/jpeg" || attempt >= 2) {
            context.globalCompositeOperation = "destination-over";
            context.fillStyle = "#ffffff";
            context.fillRect(0, 0, canvas.width, canvas.height);
            const jpeg = canvas.toDataURL("image/jpeg", 0.85);
            if (fits(jpeg)) {
              resolve(jpeg);
              return;
            }
          }
          scale *= 0.8;
        }
        reject(new Error("size"));
      };
      image.src = source;
    };
    reader.readAsDataURL(file);
  });
}

