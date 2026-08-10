/**
 * WebP Image Compression Utilities for Pooja Jewellers Day Book
 * Converts incoming photos (Files, Blobs, Camera Canvas frames) into highly optimized
 * WebP Data URLs with smart downscaling, drastically reducing database storage & load times.
 */

export interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

/**
 * Compress an image File, Blob, or Data URL string to WebP format.
 */
export function compressImageToWebP(
  input: File | Blob | string,
  options: CompressOptions = {}
): Promise<string> {
  const { maxWidth = 400, maxHeight = 400, quality = 0.75 } = options;

  return new Promise((resolve, reject) => {
    const processImage = (img: HTMLImageElement, originalSize?: number) => {
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round(height * (maxWidth / width));
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round(width * (maxHeight / height));
          height = maxHeight;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        reject(new Error("Canvas 2D context unavailable"));
        return;
      }

      // Smooth image rendering
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, width, height);

      // Attempt WebP compression
      let dataUrl = canvas.toDataURL("image/webp", quality);

      // Fallback if browser canvas fails WebP (very rare)
      if (!dataUrl.startsWith("data:image/webp")) {
        dataUrl = canvas.toDataURL("image/jpeg", quality);
      }

      if (originalSize) {
        const compressedBytes = Math.round((dataUrl.length * 3) / 4);
        const savedPct = Math.round((1 - compressedBytes / originalSize) * 100);
        console.log(
          `[WebP Compression] ${(originalSize / 1024).toFixed(1)} KB -> ${(
            compressedBytes / 1024
          ).toFixed(1)} KB (${savedPct}% smaller)`
        );
      }

      resolve(dataUrl);
    };

    if (typeof input === "string") {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => processImage(img, input.length);
      img.onerror = (err) => reject(err);
      img.src = input;
    } else {
      const reader = new FileReader();
      const originalSizeBytes = input.size;
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => processImage(img, originalSizeBytes);
        img.onerror = (err) => reject(err);
        img.src = event.target?.result as string;
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(input);
    }
  });
}

/**
 * Directly convert an HTMLCanvasElement (e.g. video camera frame) to a WebP Data URL.
 */
export function compressCanvasToWebP(
  sourceCanvas: HTMLCanvasElement,
  options: CompressOptions = {}
): string {
  const { maxWidth = 400, maxHeight = 400, quality = 0.75 } = options;

  let width = sourceCanvas.width;
  let height = sourceCanvas.height;

  if (width > height) {
    if (width > maxWidth) {
      height = Math.round(height * (maxWidth / width));
      width = maxWidth;
    }
  } else {
    if (height > maxHeight) {
      width = Math.round(width * (maxHeight / height));
      height = maxHeight;
    }
  }

  const targetCanvas = document.createElement("canvas");
  targetCanvas.width = width;
  targetCanvas.height = height;
  const ctx = targetCanvas.getContext("2d");

  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(sourceCanvas, 0, 0, width, height);
  }

  let webpDataUrl = targetCanvas.toDataURL("image/webp", quality);
  if (!webpDataUrl.startsWith("data:image/webp")) {
    webpDataUrl = targetCanvas.toDataURL("image/jpeg", quality);
  }

  return webpDataUrl;
}
