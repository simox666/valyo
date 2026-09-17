import { imageSize } from "image-size";

const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

const EXPECTED_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// A reasonable ceiling on decoded dimensions — image-size only reads header
// metadata (no pixel buffer allocated), so this isn't about memory, it's
// about rejecting a header that claims an implausible size for what a phone
// camera or the client-side resize (max 1568px) would ever produce.
const MAX_DIMENSION = 8000;

// Magic-byte/marker checks (an earlier version of this file) only look at
// the first and last few bytes — a buffer of zero padding with a real SOI
// marker at the start and a real EOI marker at the end passes them despite
// containing no decodable image (project.md D2). Parsing the actual header
// structure with `image-size` catches that: it walks real JPEG/PNG/WEBP
// segments to find the dimensions, so a structurally fake file makes it
// throw instead of returning a size.
export function isValidImagePayload(mediaType: string, data: string): boolean {
  if (data.length === 0 || data.length % 4 !== 0 || !BASE64_RE.test(data)) return false;

  const expectedType = EXPECTED_TYPE[mediaType];
  if (!expectedType) return false;

  let buf: Buffer;
  try {
    buf = Buffer.from(data, "base64");
  } catch {
    return false;
  }

  let size: { width: number; height: number; type?: string };
  try {
    size = imageSize(buf);
  } catch {
    return false;
  }

  if (size.type !== expectedType) return false;
  if (!(size.width > 0) || !(size.height > 0)) return false;
  if (size.width > MAX_DIMENSION || size.height > MAX_DIMENSION) return false;

  return true;
}
