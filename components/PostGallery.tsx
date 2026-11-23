import type { PostImage } from "@/lib/media";

const src = (id: string) => `/media/${id}`;

/** Photos d'un membre : une grande image, ou une grille de 2 à 4. */
export function PostGallery({ images, full = false }: { images: PostImage[]; full?: boolean }) {
  if (!images.length) return null;
  if (full) {
    return (
      <div className="space-y-2">
        {images.map((img) => (
          <a key={img.id} href={src(img.id)} target="_blank" rel="noopener" className="block overflow-hidden rounded-card bg-chip">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src(img.id)} alt="" width={img.width} height={img.height} loading="lazy" className="mx-auto max-h-[80vh] w-auto object-contain" />
          </a>
        ))}
      </div>
    );
  }
  if (images.length === 1) {
    const img = images[0];
    const ratio = Math.min(Math.max(img.width / img.height, 0.8), 2);
    return (
      <div className="mt-3 w-full overflow-hidden bg-chip" style={{ aspectRatio: String(ratio) }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src(img.id)} alt="" loading="lazy" className="h-full w-full object-cover" />
      </div>
    );
  }
  return (
    <div className="mt-3 grid grid-cols-2 gap-0.5 bg-line">
      {images.map((img, i) => (
        <div key={img.id} className={`overflow-hidden bg-chip ${images.length === 3 && i === 0 ? "col-span-2 aspect-[2/1]" : "aspect-square"}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src(img.id)} alt="" loading="lazy" className="h-full w-full object-cover" />
        </div>
      ))}
    </div>
  );
}
