"use client";

import type { ImageInput } from "./types";

const HEIC_TYPES = ["image/heic", "image/heif"];

function looksLikeHeic(file: File): boolean {
  if (HEIC_TYPES.includes(file.type.toLowerCase())) return true;
  // Safari/macOS sometimes leaves file.type empty for HEIC files picked from Photos.
  if (file.type === "") return /\.hei[cf]$/i.test(file.name);
  return false;
}

function loadViaImageElement(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image_decode_failed"));
    };
    img.src = url;
  });
}

interface DecodedSource {
  drawable: CanvasImageSource;
  width: number;
  height: number;
  // ImageBitmap holds decoded pixel data off-heap until closed — release it
  // once drawn so repeated scans don't accumulate memory (project.md R8).
  release: () => void;
}

// Try the browser's own decoder first — Safari/WebKit decodes HEIC natively
// via the OS codecs (broader format support than any bundled WASM decoder),
// and this path is free for every normal JPEG/PNG too. Returns null instead
// of throwing so the caller can fall back without paying for a stack trace.
async function tryNativeDecode(blob: Blob): Promise<DecodedSource | null> {
  try {
    const bitmap = await createImageBitmap(blob);
    return { drawable: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
  } catch {
    // fall through to <img>
  }
  try {
    const img = await loadViaImageElement(blob);
    return { drawable: img, width: img.naturalWidth, height: img.naturalHeight, release: () => {} };
  } catch {
    return null;
  }
}

async function decodeHeicViaWasm(file: File): Promise<DecodedSource | null> {
  try {
    // Loaded on demand — most users never hit this path (Safari decodes HEIC
    // natively, and camera capture already yields JPEG) — keeps it out of
    // the initial bundle for everyone else.
    const heic2any = (await import("heic2any")).default;
    const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.85 });
    const jpegBlob = Array.isArray(converted) ? converted[0] : converted;
    return await tryNativeDecode(jpegBlob);
  } catch (err) {
    console.error("heic2any conversion failed", err);
    return null;
  }
}

export interface ResizedImage {
  image: ImageInput;
  // Object URL for the actual re-encoded JPEG that was sent — not the
  // original file, so it renders correctly even when the source needed HEIC
  // conversion. Caller owns it and must revoke it when done (R8).
  previewUrl: string;
}

// Resizing to Claude's optimal vision input size also strips EXIF (GPS,
// device info) since the canvas re-encode drops all original metadata —
// a privacy win that comes free with the cost optimization.
export async function fileToResizedImage(
  file: File,
  maxDim = 1568,
  quality = 0.85,
): Promise<ResizedImage> {
  let decoded = await tryNativeDecode(file);

  if (!decoded && looksLikeHeic(file)) {
    decoded = await decodeHeicViaWasm(file);
  }

  if (!decoded) {
    throw new Error(
      "Cette photo ne peut pas être lue. Si c'est une photo iPhone au format HEIC, essayez de la partager d'abord dans Messages/Mail (elle sera convertie en JPEG), ou changez le format dans Réglages > Appareil photo > Formats > \"Le plus compatible\".",
    );
  }

  const { drawable, width: sourceWidth, height: sourceHeight, release } = decoded;
  const scale = Math.min(1, maxDim / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    release();
    throw new Error("Canvas non supporté sur ce navigateur");
  }
  ctx.drawImage(drawable, 0, 0, width, height);
  release();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Impossible d'encoder l'image"))),
      "image/jpeg",
      quality,
    );
  });

  return {
    image: { mediaType: "image/jpeg", data: await blobToBase64(blob) },
    previewUrl: URL.createObjectURL(blob),
  };
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
