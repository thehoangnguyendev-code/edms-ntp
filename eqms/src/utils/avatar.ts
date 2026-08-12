export const isSupportedAvatarFile = (file: File): boolean => {
  return ["image/png", "image/jpeg", "image/jpg"].includes(file.type);
};

export const isAvatarFileWithinLimit = (file: File, maxBytes = 5 * 1024 * 1024): boolean => {
  return file.size <= maxBytes;
};

export const readFileAsDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Unable to read image file"));
    reader.readAsDataURL(file);
  });
};
