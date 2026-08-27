import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const compressImage = (dataUrl: string, maxWidth: number = 500): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = dataUrl;
    img.onload = () => {
      // A same-size fallback for any failure past this point (oversized
      // canvas, decode edge case, etc.) — without this, a thrown error
      // inside onload leaves the promise unresolved forever and the
      // upload silently does nothing, since there's no catch around the
      // synchronous work below.
      try {
        const canvas = document.createElement("canvas");
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (!width || !height) {
          resolve(dataUrl);
          return;
        }

        // Calculate new dimensions
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = Math.round(width);
        canvas.height = Math.round(height);
        const ctx = canvas.getContext("2d");

        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          // Use PNG to preserve transparency, which matters for logos/stamps.
          resolve(canvas.toDataURL("image/png"));
        } else {
          resolve(dataUrl);
        }
      } catch (err) {
        console.warn("compressImage: falling back to original file", err);
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
  });
};
