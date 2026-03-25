/**
 * Compress an image file using Canvas API before upload.
 * Returns a JPEG Blob ≤ ~1MB, max 1200px on longest side.
 */
export async function compressImage(file: File): Promise<Blob> {
  const img = await createImageBitmap(file);
  const maxSize = 1200;
  const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  img.close();
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas toBlob failed"))),
      "image/jpeg",
      0.82
    );
  });
}

/** Convert a Blob to a data URL */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read blob"));
    reader.readAsDataURL(blob);
  });
}
