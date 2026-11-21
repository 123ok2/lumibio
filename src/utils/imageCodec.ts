import { LIMITS } from '../types/bio';

export type ImageTargetKind = 'avatar' | 'thumbnail';

export interface ProcessedImageResult {
  dataUrl: string;
  originalBytes: number;
  finalBytes: number;
  width: number;
  height: number;
  mimeType: string;
  wasConverted: boolean;
}

const TARGET_CONFIG: Record<
  ImageTargetKind,
  {
    maxDimension: number;
    smallDirectBytes: number;
    maxDataUrlChars: number;
  }
> = {
  avatar: {
    maxDimension: 320,
    smallDirectBytes: 50 * 1024,
    maxDataUrlChars: 96000, // Safely below Firestore rule cap of 120,000
  },
  thumbnail: {
    maxDimension: 144,
    smallDirectBytes: 22 * 1024,
    maxDataUrlChars: 40000, // Safely below Firestore rule cap of 50,000
  },
};

const DIRECT_ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_INPUT_FILE_BYTES = 25 * 1024 * 1024; // 25 MB safety cap

export function isEncodedImageDataUrl(value: string): boolean {
  return /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value);
}

export function estimateDataUrlBytes(dataUrl: string): number {
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) return 0;
  const base64 = dataUrl.slice(commaIdx + 1);
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

export function formatByteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Không thể đọc dữ liệu ảnh.'));
      }
    };
    reader.onerror = () => reject(new Error('Lỗi đọc tệp ảnh từ thiết bị.'));
    reader.readAsDataURL(file);
  });
}

function loadHtmlImage(srcUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Định dạng ảnh không được trình duyệt hỗ trợ.'));
    img.src = srcUrl;
  });
}

async function decodeImageDimensions(
  file: File
): Promise<{
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  width: number;
  height: number;
  cleanup: () => void;
}> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        width: bitmap.width,
        height: bitmap.height,
        draw: (ctx, w, h) => ctx.drawImage(bitmap, 0, 0, w, h),
        cleanup: () => bitmap.close(),
      };
    } catch {
      // Fall back to HTMLImageElement
    }
  }
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadHtmlImage(objectUrl);
    return {
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height,
      draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h),
      cleanup: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (err) {
    URL.revokeObjectURL(objectUrl);
    throw err;
  }
}

function encodeCanvas(
  canvas: HTMLCanvasElement,
  mimeType: 'image/webp' | 'image/jpeg',
  quality: number
): string {
  const dataUrl = canvas.toDataURL(mimeType, quality);
  // Some browsers fall back to image/png if image/webp is unsupported
  if (mimeType === 'image/webp' && !dataUrl.startsWith('data:image/webp;base64,')) {
    return canvas.toDataURL('image/jpeg', quality);
  }
  return dataUrl;
}

export async function processDeviceImageFile(
  file: File,
  kind: ImageTargetKind = 'avatar'
): Promise<ProcessedImageResult> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Vui lòng chọn tệp hình ảnh hợp lệ (JPG, PNG, WebP...).');
  }
  if (file.size > MAX_INPUT_FILE_BYTES) {
    throw new Error('Ảnh gốc quá lớn (tối đa 25 MB). Vui lòng chọn ảnh nhẹ hơn.');
  }

  const config = TARGET_CONFIG[kind];
  const ruleCap = kind === 'avatar' ? LIMITS.AVATAR_DATA_MAX : LIMITS.THUMBNAIL_DATA_MAX;
  const maxAllowedChars = Math.min(config.maxDataUrlChars, ruleCap);

  const decoded = await decodeImageDimensions(file);
  try {
    const { width: srcW, height: srcH, draw } = decoded;
    if (srcW <= 0 || srcH <= 0) {
      throw new Error('Không đọc được kích thước ảnh.');
    }

    // Fast path: already small image with supported MIME and compact dimensions
    if (
      file.size <= config.smallDirectBytes &&
      DIRECT_ALLOWED_MIME.has(file.type) &&
      srcW <= config.maxDimension &&
      srcH <= config.maxDimension
    ) {
      const directDataUrl = await readFileAsDataUrl(file);
      if (isEncodedImageDataUrl(directDataUrl) && directDataUrl.length <= maxAllowedChars) {
        return {
          dataUrl: directDataUrl,
          originalBytes: file.size,
          finalBytes: estimateDataUrlBytes(directDataUrl),
          width: srcW,
          height: srcH,
          mimeType: file.type,
          wasConverted: false,
        };
      }
    }

    // Conversion / compression path for large images or oversized dimensions
    const scaleBase = Math.min(1, config.maxDimension / Math.max(srcW, srcH));
    const scaleSteps = [1, 0.78, 0.6, 0.45];
    const qualitySteps = [0.82, 0.7, 0.56, 0.42, 0.3];

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Trình duyệt không hỗ trợ xử lý ảnh Canvas.');
    }

    let bestDataUrl = '';
    let bestW = srcW;
    let bestH = srcH;

    for (const stepScale of scaleSteps) {
      const targetW = Math.max(32, Math.round(srcW * scaleBase * stepScale));
      const targetH = Math.max(32, Math.round(srcH * scaleBase * stepScale));
      canvas.width = targetW;
      canvas.height = targetH;

      ctx.clearRect(0, 0, targetW, targetH);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      draw(ctx, targetW, targetH);

      for (const quality of qualitySteps) {
        let candidate = encodeCanvas(canvas, 'image/webp', quality);
        if (candidate.length > maxAllowedChars) {
          // If WebP wasn't small enough or fallback triggered, also test JPEG with clean dark/white fill?
          // Keep WebP/JPEG output clean:
          const jpegCanvas = document.createElement('canvas');
          jpegCanvas.width = targetW;
          jpegCanvas.height = targetH;
          const jCtx = jpegCanvas.getContext('2d');
          if (jCtx) {
            jCtx.fillStyle = '#09090b';
            jCtx.fillRect(0, 0, targetW, targetH);
            jCtx.imageSmoothingEnabled = true;
            jCtx.imageSmoothingQuality = 'high';
            draw(jCtx, targetW, targetH);
            const jpegCandidate = encodeCanvas(jpegCanvas, 'image/jpeg', quality);
            if (jpegCandidate.length < candidate.length) {
              candidate = jpegCandidate;
            }
          }
        }

        if (!bestDataUrl || candidate.length < bestDataUrl.length) {
          bestDataUrl = candidate;
          bestW = targetW;
          bestH = targetH;
        }

        if (isEncodedImageDataUrl(candidate) && candidate.length <= maxAllowedChars) {
          const mimeMatch = candidate.match(/^data:(image\/[a-z]+);base64,/);
          return {
            dataUrl: candidate,
            originalBytes: file.size,
            finalBytes: estimateDataUrlBytes(candidate),
            width: targetW,
            height: targetH,
            mimeType: mimeMatch?.[1] || 'image/webp',
            wasConverted: true,
          };
        }
      }
    }

    if (isEncodedImageDataUrl(bestDataUrl) && bestDataUrl.length <= ruleCap) {
      const mimeMatch = bestDataUrl.match(/^data:(image\/[a-z]+);base64,/);
      return {
        dataUrl: bestDataUrl,
        originalBytes: file.size,
        finalBytes: estimateDataUrlBytes(bestDataUrl),
        width: bestW,
        height: bestH,
        mimeType: mimeMatch?.[1] || 'image/jpeg',
        wasConverted: true,
      };
    }

    throw new Error('Không thể nén ảnh xuống dưới giới hạn lưu trữ Firebase. Hãy thử ảnh khác.');
  } finally {
    decoded.cleanup();
  }
}
