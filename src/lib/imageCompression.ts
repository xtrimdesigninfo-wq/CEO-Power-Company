export interface CompressedImageResult {
  file: File;
  dataUrl: string;
  originalSize: number;
  compressedSize: number;
}

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_OUTPUT_SIZE_MB = 5;
const MAX_OUTPUT_SIZE_BYTES = MAX_OUTPUT_SIZE_MB * 1024 * 1024;
const MAX_DIMENSION_PX = 1600;

/**
 * Validates and compresses an image to WebP with max 1600px dimension and under 5MB
 */
export async function compressProductImage(file: File): Promise<CompressedImageResult> {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new Error('Only JPG, PNG, and WebP images are supported.');
  }

  const originalSize = file.size;

  try {
    const compressedFile = await encodeFileToWebp(file);

    if (compressedFile.size > MAX_OUTPUT_SIZE_BYTES) {
      throw new Error(`Image exceeds the maximum allowed 5MB size after compression.`);
    }

    const dataUrl = await fileToDataUrl(compressedFile);

    return {
      file: compressedFile,
      dataUrl,
      originalSize,
      compressedSize: compressedFile.size,
    };
  } catch (err: any) {
    console.error('Compression failed, falling back to FileReader:', err);
    const dataUrl = await fileToDataUrl(file);
    return {
      file,
      dataUrl,
      originalSize,
      compressedSize: file.size,
    };
  }
}

async function encodeFileToWebp(file: File): Promise<File> {
  if (typeof document === 'undefined') {
    return file;
  }

  let width = 0;
  let height = 0;
  let bitmap: ImageBitmap | null = null;
  let htmlImg: HTMLImageElement | null = null;

  try {
    if (typeof createImageBitmap === 'function') {
      bitmap = await createImageBitmap(file);
      width = bitmap.width;
      height = bitmap.height;
    } else {
      htmlImg = await loadHtmlImage(file);
      width = htmlImg.naturalWidth || htmlImg.width;
      height = htmlImg.naturalHeight || htmlImg.height;
    }

    if (width <= 0 || height <= 0) {
      throw new Error('Invalid image dimensions.');
    }

    let targetW = width;
    let targetH = height;
    if (targetW > MAX_DIMENSION_PX || targetH > MAX_DIMENSION_PX) {
      if (targetW >= targetH) {
        targetH = Math.max(1, Math.round((targetH / targetW) * MAX_DIMENSION_PX));
        targetW = MAX_DIMENSION_PX;
      } else {
        targetW = Math.max(1, Math.round((targetW / targetH) * MAX_DIMENSION_PX));
        targetH = MAX_DIMENSION_PX;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context unavailable.');
    }

    if (bitmap) {
      ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    } else if (htmlImg) {
      ctx.drawImage(htmlImg, 0, 0, targetW, targetH);
    }

    let quality = 0.85;
    let outBlob = await canvasToBlob(canvas, 'image/webp', quality);

    // Only re-encode at lower quality if the encoded WebP still exceeds the 5MB cap
    let attempts = 0;
    while (outBlob.size > MAX_OUTPUT_SIZE_BYTES && attempts < 4) {
      quality = Math.max(0.45, quality - 0.12);
      outBlob = await canvasToBlob(canvas, 'image/webp', quality);
      attempts++;
    }

    const newFileName = file.name.replace(/\.[^/.]+$/, '') + '.webp';
    return new File([outBlob], newFileName, {
      type: 'image/webp',
      lastModified: Date.now(),
    });
  } finally {
    bitmap?.close();
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => {
        if (!blob || blob.size === 0) {
          reject(new Error('Failed to encode compressed image blob.'));
          return;
        }
        resolve(blob);
      },
      type,
      quality
    );
  });
}

function loadHtmlImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = err => {
      URL.revokeObjectURL(objectUrl);
      reject(err);
    };
    img.src = objectUrl;
  });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
