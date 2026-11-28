/** Crop a source image to a square blob (browser canvas). */

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const PROFILE_AVATAR_SIZE = 512;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", () => reject(new Error("Could not load that image. Try a JPEG, PNG, or WebP.")));
    img.src = src;
  });
}

/** Draw `area` from `imageSrc` into a size×size JPEG/WebP blob. */
export async function cropImageToSquareBlob(
  imageSrc: string,
  area: CropArea,
  size = PROFILE_AVATAR_SIZE,
  mimeType: "image/jpeg" | "image/webp" = "image/jpeg",
  quality = 0.92,
): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const sx = Math.max(0, Math.min(area.x, image.naturalWidth - 1));
  const sy = Math.max(0, Math.min(area.y, image.naturalHeight - 1));
  const sw = Math.max(1, Math.min(area.width, image.naturalWidth - sx));
  const sh = Math.max(1, Math.min(area.height, image.naturalHeight - sy));

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not crop this image");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, size, size);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not crop this image"))),
      mimeType,
      quality,
    );
  });
}

export function squareBlobToFile(blob: Blob, name = "avatar.jpg"): File {
  return new File([blob], name, { type: blob.type || "image/jpeg" });
}
