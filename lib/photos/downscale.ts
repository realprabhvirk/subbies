/**
 * Client-side downscale before upload: long edge 1600px, JPEG at about 0.82,
 * so a 12 MP phone photo becomes a few hundred KB and stays well under
 * Vercel's 4.5 MB request cap. The server re-encodes anyway; this only keeps
 * the upload small and fast on site. createImageBitmap applies the EXIF
 * orientation, so the canvas sees the photo the right way up.
 * Falls back to the original file if the browser can't decode it (the
 * server then gives the clear "JPEG, PNG or WebP" message).
 */
export async function downscaleForUpload(file: File, longEdge = 1600, quality = 0.82): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, longEdge / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    return blob ?? file;
  } catch {
    return file;
  }
}

/** POST with upload progress (fetch has none). Resolves with the parsed JSON body. */
export function uploadWithProgress(
  url: string,
  form: FormData,
  onProgress: (fraction: number) => void,
): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      try {
        resolve(JSON.parse(xhr.responseText));
      } catch {
        resolve({ ok: false, error: xhr.status === 413 ? "That photo is too large." : "Upload failed. Try again." });
      }
    };
    xhr.onerror = () => resolve({ ok: false, error: "Upload failed. Check your connection and try again." });
    xhr.send(form);
  });
}
