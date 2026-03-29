import type { ClipboardData } from '../store/documentStore';

/**
 * Checks if a rectangular region in the given ImageData is completely transparent.
 */
export function isRegionTransparent(
  imageData: ImageData,
  x: number,
  y: number,
  width: number,
  height: number
): boolean {
  const data = imageData.data;
  const imgWidth = imageData.width;
  const imgHeight = imageData.height;

  // Bound checks
  const startX = Math.max(0, x);
  const startY = Math.max(0, y);
  const endX = Math.min(imgWidth, x + width);
  const endY = Math.min(imgHeight, y + height);

  for (let cy = startY; cy < endY; cy++) {
    for (let cx = startX; cx < endX; cx++) {
      const idx = (cy * imgWidth + cx) * 4;
      const alpha = data[idx + 3];
      if (alpha > 0) {
        return false; // Found a non-transparent pixel
      }
    }
  }
  return true;
}

/**
 * Copies a region from an HTMLCanvasElement into a ClipboardData object.
 */
export function copyRegion(
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
  width: number,
  height: number
): ClipboardData | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  try {
    const imageData = ctx.getImageData(x, y, width, height);
    return {
      imageData,
      width,
      height
    };
  } catch (err) {
    console.error('Failed to copy region:', err);
    return null;
  }
}

/**
 * Clear a region in the canvas (Cut operation)
 */
export function clearRegion(
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(x, y, width, height);
}

/**
 * Pastes clipboard data onto the canvas at the specified location.
 */
export function pasteRegion(
  canvas: HTMLCanvasElement,
  clipboard: ClipboardData,
  x: number,
  y: number
): boolean {
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;

  // We need to check transparency before pasting
  // First, get the target region's image data
  const targetData = ctx.getImageData(x, y, clipboard.width, clipboard.height);

  if (!isRegionTransparent(targetData, 0, 0, clipboard.width, clipboard.height)) {
    // Cannot paste, region is not transparent
    return false;
  }

  // Region is transparent, we can paste!
  // To paste ImageData directly:
  ctx.putImageData(clipboard.imageData, x, y);
  return true;
}

/**
 * Gets the bounding box of non-transparent pixels in a region.
 * Returns null if the region is completely transparent.
 */
export function getTrimmedBounds(
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
  width: number,
  height: number
): { x: number, y: number, width: number, height: number } | null {
  const ctx = canvas.getContext('2d');
  if (!ctx || width <= 0 || height <= 0) return null;

  let imageData;
  try {
    imageData = ctx.getImageData(x, y, width, height);
  } catch(e) { return null; }
  
  const data = imageData.data;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let cy = 0; cy < height; cy++) {
    for (let cx = 0; cx < width; cx++) {
      const alpha = data[(cy * width + cx) * 4 + 3];
      if (alpha > 0) {
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;
      }
    }
  }

  if (maxX === -1) {
    return null; // completely transparent
  }

  return {
    x: x + minX,
    y: y + minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1
  };
}
