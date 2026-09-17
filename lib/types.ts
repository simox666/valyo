export interface ImageInput {
  mediaType: "image/jpeg" | "image/png" | "image/webp";
  data: string; // base64, no data: URL prefix
}
