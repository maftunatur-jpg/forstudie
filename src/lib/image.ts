// Bildhantering i webbläsaren.

async function decode(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(blob, { imageOrientation: "from-image" });
    } catch {
      /* faller tillbaka till <img> */
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Skalar ner till max `maxSize` px på längsta sidan och kodar som JPEG. */
export async function resizeImage(blob: Blob, maxSize = 1600, quality = 0.82) {
  const src = await decode(blob);
  const w0 = "naturalWidth" in src ? src.naturalWidth : src.width;
  const h0 = "naturalHeight" in src ? src.naturalHeight : src.height;
  const scale = Math.min(1, maxSize / Math.max(w0, h0));
  const width = Math.max(1, Math.round(w0 * scale));
  const height = Math.max(1, Math.round(h0 * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(src, 0, 0, width, height);
  if ("close" in src) src.close();
  const out = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Kunde inte koda bilden."))), "image/jpeg", quality),
  );
  // Frigör canvasminnet direkt (viktigt vid hundratals bilder).
  canvas.width = canvas.height = 0;
  return { blob: out, width, height };
}

export async function blobToBytes(blob: Blob) {
  return new Uint8Array(await blob.arrayBuffer());
}

export async function blobToBase64(blob: Blob) {
  const bytes = await blobToBytes(blob);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
