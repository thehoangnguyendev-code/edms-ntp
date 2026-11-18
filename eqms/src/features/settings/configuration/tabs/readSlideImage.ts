/** The biggest picture that may be chosen; it is reduced before it is saved. */
export const SLIDE_MAX_UPLOAD = 15 * 1024 * 1024;
/** What is kept: a slide fills a panel of about 700 x 960 px, so 1600 px on the long side is sharp on a large screen. The server takes 1 MB. */
const SLIDE_MAX_SIDE = 1600;
const SLIDE_MAX_DATA_URL = 1_000_000;

/**
 * Reads a slide picture as a JPEG data URL that fits the limit of the server. The picture is scaled so its long side is at most 1600 px, then its quality is
 * lowered, and if it is still too heavy its size is reduced, step by step, until it fits. A slide fills the whole panel, so transparency is not kept (it becomes white).
 */
export function readSlideImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('image'));
      image.onload = () => {
        const width = image.naturalWidth;
        const height = image.naturalHeight;
        if (!width || !height) {
          reject(new Error('image'));
          return;
        }
        let scale = Math.min(1, SLIDE_MAX_SIDE / Math.max(width, height));
        for (let attempt = 0; attempt < 8; attempt++) {
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(width * scale));
          canvas.height = Math.max(1, Math.round(height * scale));
          const context = canvas.getContext('2d');
          if (!context) {
            reject(new Error('canvas'));
            return;
          }
          context.fillStyle = '#ffffff';
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          for (const quality of [0.86, 0.74, 0.62]) {
            const jpeg = canvas.toDataURL('image/jpeg', quality);
            if (jpeg.length <= SLIDE_MAX_DATA_URL) {
              resolve(jpeg);
              return;
            }
          }
          scale *= 0.8;
        }
        reject(new Error('size'));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
