const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

// A real photo is always well over this after any lossy JPEG/PNG/WEBP
// encoding — a buffer this small can only be a hand-crafted probe, never a
// legitimate capture. Checking just the first 3 bytes (the JPEG SOI marker)
// let a 3-byte truncated buffer pass as "valid" (project.md C3); requiring a
// plausible minimum size plus a structural end-of-file check catches that
// without needing a full image decoder.
const MIN_PLAUSIBLE_BYTES = 128;

function hasJpegMagic(buf: Buffer): boolean {
  if (buf.length < MIN_PLAUSIBLE_BYTES) return false;
  const startsOk = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const endsOk = buf[buf.length - 2] === 0xff && buf[buf.length - 1] === 0xd9; // EOI marker
  return startsOk && endsOk;
}

function hasPngMagic(buf: Buffer): boolean {
  if (buf.length < MIN_PLAUSIBLE_BYTES) return false;
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const startsOk = signature.every((byte, i) => buf[i] === byte);
  // A valid PNG's last chunk is always a 12-byte IEND (4-byte zero length +
  // "IEND" + 4-byte CRC) — its type field sits 8 bytes from the end.
  const endsOk = buf.subarray(buf.length - 8, buf.length - 4).toString("ascii") === "IEND";
  return startsOk && endsOk;
}

function hasWebpMagic(buf: Buffer): boolean {
  if (buf.length < MIN_PLAUSIBLE_BYTES) return false;
  const startsOk =
    buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP";
  if (!startsOk) return false;
  // The RIFF header declares the byte size of everything after itself —
  // cross-check it against the actual buffer length (small slack for
  // encoders that pad with a trailing byte).
  const declaredSize = buf.readUInt32LE(4);
  return Math.abs(declaredSize - (buf.length - 8)) <= 16;
}

const MAGIC_CHECKS: Record<string, (buf: Buffer) => boolean> = {
  "image/jpeg": hasJpegMagic,
  "image/png": hasPngMagic,
  "image/webp": hasWebpMagic,
};

// A declared Content-Type / mediaType is just a client-supplied label —
// this checks the actual bytes look like a complete, well-formed image
// before we spend a paid vision call on them (project.md R4/C3). Not a full
// decode: dimension/pixel validation would need a real image library and is
// a documented follow-up, not done here.
export function isValidImagePayload(mediaType: string, data: string): boolean {
  if (data.length === 0 || data.length % 4 !== 0 || !BASE64_RE.test(data)) return false;

  const check = MAGIC_CHECKS[mediaType];
  if (!check) return false;

  let buf: Buffer;
  try {
    buf = Buffer.from(data, "base64");
  } catch {
    return false;
  }

  return check(buf);
}
